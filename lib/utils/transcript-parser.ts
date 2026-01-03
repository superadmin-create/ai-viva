/**
 * Parse transcript into Q&A pairs
 * Handles Vapi transcript format with AI: and Student: prefixes
 */

import type { QuestionAnswerPair, ParsedTranscript } from "@/lib/types/vapi";

/**
 * Check if text contains a question
 */
function containsQuestion(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Has question mark
  if (text.includes("?")) return true;

  // Starts with question words
  const questionPatterns = [
    /\b(what|how|why|when|where|which|who|whom|whose)\b/i,
    /\b(can you|could you|would you|will you)\b/i,
    /\b(explain|describe|define|tell me|give me|list|name)\b/i,
    /\b(is it|are there|do you|does it|have you|has it)\b/i,
  ];

  return questionPatterns.some(pattern => pattern.test(lower));
}

/**
 * Extract the question part from AI message
 * Sometimes AI says multiple things, we want just the question
 */
function extractQuestion(text: string): string {
  if (!text) return "";

  // If the whole thing is relatively short, use it all
  if (text.length < 200) return text;

  // Try to find the last question in the text
  const sentences = text.split(/(?<=[.!?])\s+/);

  // Find sentences that are questions (have ? or question words)
  const questions = sentences.filter(s => containsQuestion(s));

  if (questions.length > 0) {
    // Return the last question (usually the actual question being asked)
    return questions[questions.length - 1].trim();
  }

  // Fallback to last 2-3 sentences
  return sentences.slice(-3).join(" ").trim();
}

export function parseTranscript(transcript: string): ParsedTranscript {
  if (!transcript || transcript.trim().length === 0) {
    return {
      questions: [],
      conversation: transcript,
    };
  }

  const questions: QuestionAnswerPair[] = [];

  // Split by lines and parse
  const lines = transcript.split("\n").filter((line) => line.trim().length > 0);

  let currentQuestion: string | null = null;
  let currentAnswer: string = "";
  let questionNumber = 1;
  let lastRole: "AI" | "Student" | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if line starts with AI: or Student:
    const aiMatch = trimmedLine.match(/^(?:AI|bot|assistant):\s*(.+)/i);
    const studentMatch = trimmedLine.match(/^(?:Student|user):\s*(.+)/i);

    if (aiMatch) {
      const aiMessage = aiMatch[1].trim();

      // If we have a pending question and answer, save it
      if (currentQuestion && currentAnswer.trim()) {
        questions.push({
          question: currentQuestion,
          answer: currentAnswer.trim(),
          questionNumber: questionNumber++,
        });
        currentAnswer = "";
      }

      // Check if AI message contains a question
      if (containsQuestion(aiMessage)) {
        currentQuestion = extractQuestion(aiMessage);
        currentAnswer = "";
      } else {
        // AI is speaking but not asking a question (greeting, feedback, etc.)
        // Keep currentQuestion if we're waiting for an answer
        if (lastRole !== "AI") {
          currentQuestion = null;
        }
      }

      lastRole = "AI";
    } else if (studentMatch) {
      const studentMessage = studentMatch[1].trim();

      // If there's a current question, accumulate the answer
      if (currentQuestion) {
        currentAnswer += (currentAnswer ? " " : "") + studentMessage;
      }

      lastRole = "Student";
    }
  }

  // Don't forget the last Q&A pair
  if (currentQuestion && currentAnswer.trim()) {
    questions.push({
      question: currentQuestion,
      answer: currentAnswer.trim(),
      questionNumber: questionNumber++,
    });
  }

  // If no Q&A pairs found but transcript exists, try alternative parsing
  // Sometimes transcripts have questions but student didn't complete answers
  if (questions.length === 0 && lines.length > 0) {
    // Find all AI messages that are questions
    let questionsAsked = 0;
    for (const line of lines) {
      const aiMatch = line.trim().match(/^(?:AI|bot|assistant):\s*(.+)/i);
      if (aiMatch && containsQuestion(aiMatch[1])) {
        questionsAsked++;
      }
    }

    // If questions were asked but no complete Q&A pairs, note this
    if (questionsAsked > 0) {
      console.log(`[TranscriptParser] Found ${questionsAsked} questions but no complete Q&A pairs`);
    }
  }

  console.log(`[TranscriptParser] Extracted ${questions.length} Q&A pairs from ${lines.length} lines`);

  return {
    questions,
    conversation: transcript,
  };
}

/**
 * Clean transcript for display - remove role prefixes and format nicely
 */
export function cleanTranscriptForDisplay(transcript: string): string {
  if (!transcript) return "";

  const lines = transcript.split("\n").filter(line => line.trim());
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Replace AI: with "Examiner:" for display
    if (trimmed.match(/^(?:AI|bot|assistant):/i)) {
      cleaned.push(trimmed.replace(/^(?:AI|bot|assistant):/i, "Examiner:"));
    } else if (trimmed.match(/^(?:Student|user):/i)) {
      cleaned.push(trimmed.replace(/^(?:Student|user):/i, "Student:"));
    } else {
      cleaned.push(trimmed);
    }
  }

  return cleaned.join("\n");
}
