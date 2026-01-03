/**
 * Evaluate viva session using AI (Anthropic Claude)
 * Provides intelligent evaluation of Q&A pairs based on subject context
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  QuestionAnswerPair,
  VivaEvaluation,
  EvaluationMarks,
  EvaluationFeedback,
} from "@/lib/types/vapi";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AIEvaluationResult {
  questionNumber: number;
  marks: number;
  maxMarks: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

interface AIOverallResult {
  evaluations: AIEvaluationResult[];
  overallFeedback: string;
}

/**
 * Use AI to evaluate viva Q&A pairs
 */
async function evaluateWithAI(
  qaPairs: QuestionAnswerPair[],
  subject: string
): Promise<AIOverallResult> {
  const maxMarksPerQuestion = 3;

  // Build the evaluation prompt
  const qaPairsText = qaPairs
    .map(
      (qa, idx) =>
        `Question ${idx + 1}: ${qa.question}\nStudent's Answer: ${qa.answer || "(No answer provided)"}`
    )
    .join("\n\n");

  const prompt = `You are an expert examiner evaluating a student's viva voce (oral examination) in ${subject}.

Evaluate each of the following question-answer pairs. For each answer:
1. Assign a score from 0 to ${maxMarksPerQuestion} marks based on:
   - 0: No answer or completely incorrect
   - 1: Partial understanding, significant gaps
   - 2: Good understanding with minor gaps
   - 3: Excellent, comprehensive answer

2. Provide specific, constructive feedback
3. List 1-2 specific strengths (if any)
4. List 1-2 specific areas for improvement (if any)

Questions and Answers:
${qaPairsText}

Respond in this exact JSON format:
{
  "evaluations": [
    {
      "questionNumber": 1,
      "marks": <0-3>,
      "maxMarks": ${maxMarksPerQuestion},
      "feedback": "<specific feedback for this answer>",
      "strengths": ["<strength 1>", "<strength 2>"],
      "weaknesses": ["<weakness 1>", "<weakness 2>"]
    }
  ],
  "overallFeedback": "<overall summary of the student's performance with specific recommendations>"
}

Be fair but honest. Focus on helping the student improve. Only return valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Use Haiku for speed and cost efficiency
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in AI response");
    }

    // Parse JSON response
    const jsonText = textContent.text.trim();
    // Handle potential markdown code blocks
    const cleanJson = jsonText.replace(/```json\n?|\n?```/g, "").trim();
    const result: AIOverallResult = JSON.parse(cleanJson);

    console.log("[Evaluator] AI evaluation successful");
    return result;
  } catch (error) {
    console.error("[Evaluator] AI evaluation failed:", error);
    throw error;
  }
}

/**
 * Fallback evaluation when AI is unavailable
 */
function fallbackEvaluation(
  qaPairs: QuestionAnswerPair[]
): AIOverallResult {
  const maxMarksPerQuestion = 3;

  const evaluations: AIEvaluationResult[] = qaPairs.map((qa, idx) => {
    const answerLength = qa.answer?.length || 0;
    let score = 0;

    if (answerLength === 0) {
      score = 0;
    } else if (answerLength < 50) {
      score = 1;
    } else if (answerLength < 150) {
      score = 2;
    } else {
      score = 3;
    }

    // Penalize for uncertainty phrases
    const lowerAnswer = (qa.answer || "").toLowerCase();
    if (lowerAnswer.includes("don't know") || lowerAnswer.includes("not sure")) {
      score = Math.min(score, 1);
    }

    return {
      questionNumber: idx + 1,
      marks: score,
      maxMarks: maxMarksPerQuestion,
      feedback: getFallbackFeedback(score),
      strengths: score >= 2 ? ["Provided a response"] : [],
      weaknesses: score < 2 ? ["Answer could be more detailed"] : [],
    };
  });

  const totalMarks = evaluations.reduce((sum, e) => sum + e.marks, 0);
  const maxTotal = evaluations.length * maxMarksPerQuestion;
  const percentage = maxTotal > 0 ? (totalMarks / maxTotal) * 100 : 0;

  return {
    evaluations,
    overallFeedback: getFallbackOverallFeedback(percentage, qaPairs.length),
  };
}

function getFallbackFeedback(score: number): string {
  switch (score) {
    case 0:
      return "No answer provided. Please review this topic.";
    case 1:
      return "Partial answer. Try to provide more details and examples.";
    case 2:
      return "Good answer with relevant points covered.";
    case 3:
      return "Excellent answer with comprehensive coverage.";
    default:
      return "Answer reviewed.";
  }
}

function getFallbackOverallFeedback(percentage: number, questionCount: number): string {
  if (percentage >= 80) {
    return `Excellent performance! You answered ${questionCount} questions with strong understanding.`;
  } else if (percentage >= 60) {
    return `Good performance! You demonstrated understanding but could benefit from more detailed explanations.`;
  } else if (percentage >= 40) {
    return `Fair performance. Review the topics and focus on providing more comprehensive answers.`;
  } else {
    return `Needs improvement. Please review the subject material and practice answering more thoroughly.`;
  }
}

/**
 * Main evaluation function - uses AI when available, falls back to heuristics
 */
export async function evaluateViva(
  qaPairs: QuestionAnswerPair[],
  subject?: string
): Promise<VivaEvaluation> {
  if (qaPairs.length === 0) {
    return {
      marks: [],
      feedback: [],
      totalMarks: 0,
      maxTotalMarks: 0,
      percentage: 0,
      overallFeedback: "No questions answered.",
    };
  }

  const maxMarksPerQuestion = 3;
  let aiResult: AIOverallResult;

  // Try AI evaluation first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log("[Evaluator] Using AI evaluation");
      aiResult = await evaluateWithAI(qaPairs, subject || "General");
    } catch (error) {
      console.warn("[Evaluator] AI evaluation failed, using fallback:", error);
      aiResult = fallbackEvaluation(qaPairs);
    }
  } else {
    console.log("[Evaluator] ANTHROPIC_API_KEY not set, using fallback evaluation");
    aiResult = fallbackEvaluation(qaPairs);
  }

  // Convert AI result to our format
  const marks: EvaluationMarks[] = [];
  const feedback: EvaluationFeedback[] = [];
  let totalMarks = 0;

  for (let i = 0; i < qaPairs.length; i++) {
    const qa = qaPairs[i];
    const aiEval = aiResult.evaluations.find(
      (e) => e.questionNumber === i + 1
    ) || {
      marks: 0,
      maxMarks: maxMarksPerQuestion,
      feedback: "Unable to evaluate",
      strengths: [],
      weaknesses: [],
    };

    marks.push({
      questionNumber: i + 1,
      question: qa.question,
      answer: qa.answer,
      marks: aiEval.marks,
      maxMarks: aiEval.maxMarks,
    });

    feedback.push({
      questionNumber: i + 1,
      feedback: aiEval.feedback,
      strengths: aiEval.strengths.length > 0 ? aiEval.strengths : undefined,
      weaknesses: aiEval.weaknesses.length > 0 ? aiEval.weaknesses : undefined,
    });

    totalMarks += aiEval.marks;
  }

  const maxTotalMarks = qaPairs.length * maxMarksPerQuestion;
  const percentage = maxTotalMarks > 0 ? (totalMarks / maxTotalMarks) * 100 : 0;

  return {
    marks,
    feedback,
    totalMarks,
    maxTotalMarks,
    percentage: Math.round(percentage * 100) / 100,
    overallFeedback: aiResult.overallFeedback,
  };
}
