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
  const maxMarksPerQuestion = 10;

  // Build the evaluation prompt
  const qaPairsText = qaPairs
    .map(
      (qa, idx) =>
        `Question ${idx + 1}: ${qa.question}\nStudent's Answer: ${qa.answer || "(No answer provided)"}`
    )
    .join("\n\n");

  const prompt = `You are a strict and thorough examiner evaluating a student's viva voce (oral examination) in ${subject}. Be critical and demanding - only award full marks for truly excellent answers.

CRITICAL: You are evaluating based on the TRANSCRIBED TEXT of the student's answers, not audio quality or vocal delivery. Focus on the CONTENT and MEANING of what the student said, as transcribed. Do not penalize for transcription errors, filler words, or speech disfluencies. Evaluate the actual knowledge and understanding demonstrated in the transcribed text.

Evaluate each of the following question-answer pairs. For each answer:
1. Assign a score from 0 to ${maxMarksPerQuestion} marks based on STRICT criteria:
   - 0-2: No answer, completely incorrect, or shows no understanding of the concept
   - 3-4: Shows minimal understanding with major gaps, incorrect key concepts, or vague/irrelevant answers
   - 5-6: Demonstrates basic understanding but missing important details, examples, or connections. Answer is partially correct but incomplete
   - 7-8: Good answer - demonstrates solid understanding with most key points covered, includes some examples, but may lack depth or comprehensive coverage
   - 9-10: Excellent answer - comprehensive, accurate, well-structured, includes relevant examples, demonstrates deep understanding, and connects concepts appropriately. ONLY award 9-10 marks if the answer is truly exceptional and complete.
   
   IMPORTANT: Be strict. A good answer that lacks depth or examples should get 7-8 marks, not 9-10. Only award 9-10 marks for answers that are truly comprehensive and demonstrate mastery.
   IMPORTANT: Evaluate based on the TRANSCRIBED CONTENT. If the transcript shows the student understood the concept but had some filler words or minor transcription issues, focus on the actual knowledge demonstrated.

2. Provide detailed, specific, and constructive feedback (2-4 sentences) that:
   - Explains what the student did well or where they went wrong based on the TRANSCRIBED TEXT
   - Points out specific concepts they understood or missed (as shown in the transcript)
   - Suggests how they could improve their answer
   - References specific parts of their transcribed answer when relevant
   - Note: Base feedback on what was actually said (as transcribed), not assumptions

3. List 2-3 specific strengths (if any) - be specific about what they demonstrated correctly in their transcribed answers

4. List 2-3 specific areas for improvement (if any) - provide actionable suggestions based on what was missing or incorrect in the transcribed answers

For the overall feedback, provide a comprehensive summary (4-6 sentences) that:
- Summarizes the student's overall performance across all questions (based on transcribed answers)
- Highlights key strengths demonstrated throughout the examination (as shown in transcript)
- Identifies common areas that need improvement (based on transcript analysis)
- Provides specific, actionable recommendations for future study
- Mentions which topics or concepts they should focus on
- Encourages them while being honest about areas needing work

Questions and Answers (from transcript):
${qaPairsText}

Respond in this exact JSON format:
{
  "evaluations": [
    {
      "questionNumber": 1,
      "marks": <0-10>,
      "maxMarks": ${maxMarksPerQuestion},
      "feedback": "<detailed 2-4 sentence feedback explaining what was good/bad and how to improve>",
      "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
      "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", "<specific weakness 3>"]
    }
  ],
  "overallFeedback": "<comprehensive 4-6 sentence summary with specific recommendations and encouragement>"
}

Be fair but honest. Focus on helping the student improve with actionable, specific feedback. Only return valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307", // Use Haiku for speed and cost efficiency
      max_tokens: 4000, // Increased for more detailed feedback
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
  const maxMarksPerQuestion = 10;

  const evaluations: AIEvaluationResult[] = qaPairs.map((qa, idx) => {
    const answerLength = qa.answer?.length || 0;
    let score = 0;

    // Scoring criteria based on answer length (0-10 scale)
    if (answerLength === 0) {
      score = 0;
    } else if (answerLength < 30) {
      // Very short answer - minimal understanding
      score = 2;
    } else if (answerLength < 80) {
      // Short answer - minimal understanding with major gaps
      score = 4;
    } else if (answerLength < 200) {
      // Moderate answer - basic understanding but incomplete
      score = 6;
    } else if (answerLength < 400) {
      // Good answer - solid understanding with most key points
      score = 8;
    } else {
      // Comprehensive answer - detailed and thorough
      score = 10;
    }

    // Stricter penalties for uncertainty phrases
    const lowerAnswer = (qa.answer || "").toLowerCase();
    if (lowerAnswer.includes("don't know") || lowerAnswer.includes("not sure") || 
        lowerAnswer.includes("i think") || lowerAnswer.includes("maybe") ||
        lowerAnswer.includes("i'm not certain")) {
      score = Math.min(score, 4);
    }
    
    // Additional penalty for very short answers even if they exist
    if (answerLength > 0 && answerLength < 20) {
      score = Math.min(score, 1);
    }

    return {
      questionNumber: idx + 1,
      marks: score,
      maxMarks: maxMarksPerQuestion,
      feedback: getFallbackFeedback(score),
      strengths: score >= 5 ? ["Provided a response"] : [],
      weaknesses: score < 5 ? ["Answer could be more detailed"] : [],
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
  if (score >= 0 && score <= 2) {
    return "No answer or completely incorrect. Please review this topic thoroughly.";
  } else if (score >= 3 && score <= 4) {
    return "Minimal understanding shown. Try to provide more details, examples, and correct key concepts.";
  } else if (score >= 5 && score <= 6) {
    return "Basic understanding demonstrated but missing important details. Elaborate with examples and connections.";
  } else if (score >= 7 && score <= 8) {
    return "Good answer with relevant points covered. Consider adding more depth and comprehensive coverage.";
  } else if (score >= 9 && score <= 10) {
    return "Excellent answer with comprehensive coverage and deep understanding demonstrated.";
  } else {
    return "Answer reviewed.";
  }
}

function getFallbackOverallFeedback(percentage: number, questionCount: number): string {
  if (percentage >= 80) {
    return `Excellent performance! You answered ${questionCount} questions with strong understanding and demonstrated a comprehensive grasp of the subject matter. Your answers showed depth, clarity, and good conceptual understanding. Continue building on these strengths and consider exploring more advanced topics to further enhance your knowledge.`;
  } else if (percentage >= 60) {
    return `Good performance! You demonstrated solid understanding of the core concepts and answered ${questionCount} questions. Your responses showed that you have a foundation in the subject, but there's room to provide more detailed explanations and examples. Focus on elaborating your answers with specific examples, real-world applications, and connecting related concepts to strengthen your understanding further.`;
  } else if (percentage >= 40) {
    return `Fair performance. You answered ${questionCount} questions, showing some understanding of the subject matter. However, your answers need more depth and detail. Review the fundamental concepts thoroughly, practice explaining topics in your own words, and work on providing more comprehensive answers that demonstrate your understanding. Consider studying the material more systematically and practicing with sample questions.`;
  } else {
    return `Your performance indicates that you need to review the subject material more thoroughly. You answered ${questionCount} questions, but the responses lacked sufficient detail and understanding. Focus on: (1) Reviewing the core concepts and fundamentals, (2) Understanding the relationships between different topics, (3) Practicing explaining concepts clearly, and (4) Seeking clarification on areas where you're uncertain. With dedicated study and practice, you can significantly improve your performance.`;
  }
}

/**
 * Main evaluation function - uses AI when available, falls back to heuristics
 * 
 * IMPORTANT: This function evaluates based ONLY on the transcribed text from the viva session.
 * It does NOT use audio quality, vocal delivery, or any non-transcript data.
 * The qaPairs parameter contains question-answer pairs extracted from the transcript.
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
      overallFeedback: "No questions answered in transcript.",
    };
  }

  // Log that we're evaluating based on transcript
  console.log(`[Evaluator] Evaluating ${qaPairs.length} Q&A pairs from transcript for subject: ${subject || "General"}`);
  qaPairs.forEach((qa, idx) => {
    console.log(`[Evaluator] Q${idx + 1} (from transcript): "${qa.question.substring(0, 80)}..."`);
    console.log(`[Evaluator] A${idx + 1} (from transcript): "${qa.answer.substring(0, 80)}..."`);
  });

  const maxMarksPerQuestion = 10;
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
