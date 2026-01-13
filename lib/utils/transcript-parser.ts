/**
 * Parse transcript into Q&A pairs
 * Handles Vapi transcript format with AI: and Student: prefixes
 * Improved accuracy for better evaluation based on transcript
 */

import type { QuestionAnswerPair, ParsedTranscript } from "@/lib/types/vapi";

/**
 * Clean and normalize transcript text
 * Removes filler words, normalizes spacing, fixes common transcription errors
 */
function cleanTranscriptText(text: string): string {
  if (!text) return "";
  
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, " ").trim();
  
  // Fix common transcription errors
  const fixes: [RegExp, string][] = [
    [/\.\.\./g, " "], // Remove ellipses
    [/um\s+/gi, " "], // Remove filler words
    [/uh\s+/gi, " "],
    [/er\s+/gi, " "],
    [/ah\s+/gi, " "],
    [/\s+([,.!?])/g, "$1"], // Fix spacing before punctuation
    [/([,.!?])\s*([,.!?])+/g, "$1"], // Remove duplicate punctuation
  ];
  
  for (const [pattern, replacement] of fixes) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  
  // Normalize spacing again after fixes
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  return cleaned;
}

/**
 * Check if text contains a question
 * Enhanced detection for better accuracy
 */
function containsQuestion(text: string): boolean {
  if (!text) return false;
  const cleaned = cleanTranscriptText(text);
  const lower = cleaned.toLowerCase();

  // Has question mark
  if (cleaned.includes("?")) return true;

  // Starts with question words (more comprehensive patterns)
  const questionPatterns = [
    /\b(what|how|why|when|where|which|who|whom|whose)\b/i,
    /\b(can you|could you|would you|will you|do you|does|did|are|is|was|were)\b/i,
    /\b(explain|describe|define|tell me|give me|list|name|provide|elaborate|discuss)\b/i,
    /\b(is it|are there|do you|does it|have you|has it|can you explain|can you tell)\b/i,
    /\b(what is|what are|how does|how do|why is|why are|when does|when do)\b/i,
  ];

  // Check if it's a question pattern
  const hasQuestionPattern = questionPatterns.some(pattern => pattern.test(lower));
  
  // Additional check: if sentence ends with rising intonation indicators
  const endsWithQuestion = /(right|correct|isn't it|aren't they|don't you|doesn't it)$/i.test(lower);
  
  return hasQuestionPattern || endsWithQuestion;
}

/**
 * Extract the question part from AI message
 * Sometimes AI says multiple things, we want just the question
 * Improved to handle conversational context better
 */
function extractQuestion(text: string): string {
  if (!text) return "";
  
  const cleaned = cleanTranscriptText(text);

  // If the whole thing is relatively short, use it all
  if (cleaned.length < 200) return cleaned;

  // Split by sentences more accurately
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);

  // Find sentences that are questions (have ? or question words)
  const questions = sentences.filter(s => containsQuestion(s.trim()));

  if (questions.length > 0) {
    // Return the last question (usually the actual question being asked)
    // But also include context if the question is very short
    const lastQuestion = questions[questions.length - 1].trim();
    if (lastQuestion.length < 20 && questions.length > 1) {
      // Include previous question for context
      return questions[questions.length - 2] + " " + lastQuestion;
    }
    return lastQuestion;
  }

  // Fallback: look for question patterns in last few sentences
  const lastSentences = sentences.slice(-3);
  for (let i = lastSentences.length - 1; i >= 0; i--) {
    if (containsQuestion(lastSentences[i])) {
      return lastSentences.slice(i).join(" ").trim();
    }
  }

  // Final fallback to last 2-3 sentences
  return lastSentences.join(" ").trim();
}

export function parseTranscript(transcript: string): ParsedTranscript {
  if (!transcript || transcript.trim().length === 0) {
    return {
      questions: [],
      conversation: transcript,
    };
  }

  const questions: QuestionAnswerPair[] = [];

  // Clean the transcript first
  const cleanedTranscript = cleanTranscriptText(transcript);

  // Split by lines and parse - handle various formats
  const lines = cleanedTranscript.split("\n").filter((line) => line.trim().length > 0);

  let currentQuestion: string | null = null;
  let currentAnswer: string = "";
  let questionNumber = 1;
  let lastRole: "AI" | "Student" | null = null;
  let consecutiveStudentMessages = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Enhanced pattern matching for various transcript formats
    // Handle: "AI:", "Bot:", "Assistant:", "Examiner:", etc.
    const aiMatch = trimmedLine.match(/^(?:AI|bot|assistant|examiner|teacher):\s*(.+)/i);
    // Handle: "Student:", "User:", "Candidate:", etc.
    const studentMatch = trimmedLine.match(/^(?:Student|user|candidate|you):\s*(.+)/i);

    if (aiMatch) {
      const aiMessage = cleanTranscriptText(aiMatch[1]);

      // If we have a pending question and answer, save it
      if (currentQuestion && currentAnswer.trim()) {
        questions.push({
          question: cleanTranscriptText(currentQuestion),
          answer: cleanTranscriptText(currentAnswer.trim()),
          questionNumber: questionNumber++,
        });
        currentAnswer = "";
        currentQuestion = null;
      }

      // Check if AI message contains a question
      if (containsQuestion(aiMessage)) {
        currentQuestion = extractQuestion(aiMessage);
        currentAnswer = "";
        consecutiveStudentMessages = 0;
      } else {
        // AI is speaking but not asking a question (greeting, feedback, etc.)
        // Only clear current question if we're not waiting for an answer
        if (lastRole === "Student" && currentQuestion) {
          // AI is providing feedback, keep the question
          // Don't clear it
        } else if (lastRole !== "AI") {
          // New AI turn without a question, clear previous context
          currentQuestion = null;
          currentAnswer = "";
        }
      }

      lastRole = "AI";
      consecutiveStudentMessages = 0;
    } else if (studentMatch) {
      const studentMessage = cleanTranscriptText(studentMatch[1]);

      // Skip empty or very short filler responses
      if (studentMessage.length < 3 || /^(yes|no|ok|okay|yeah|yep|nope|hmm|uh|um)$/i.test(studentMessage)) {
        // These are just acknowledgments, don't treat as full answers
        if (currentQuestion && currentAnswer.trim()) {
          // We already have an answer, this is just acknowledgment
          lastRole = "Student";
          continue;
        }
      }

      // If there's a current question, accumulate the answer
      if (currentQuestion) {
        if (consecutiveStudentMessages > 0) {
          // Multiple student messages for same question - add as continuation
          currentAnswer += (currentAnswer ? " " : "") + studentMessage;
        } else {
          // First student response to this question
          currentAnswer = studentMessage;
        }
        consecutiveStudentMessages++;
      } else {
        // Student is speaking but no active question
        // This might be an unsolicited response or continuation
        // Try to find if there was a recent question we missed
        if (questions.length > 0 && lastRole === "Student") {
          // Append to last answer if it was very recent
          const lastQ = questions[questions.length - 1];
          if (lastQ && lastQ.answer.length < 100) {
            // Last answer was short, might be incomplete
            lastQ.answer += " " + studentMessage;
          }
        }
      }

      lastRole = "Student";
    } else {
      // Line doesn't match expected format - might be continuation
      if (lastRole === "Student" && currentAnswer) {
        // Continuation of student answer (multi-line)
        currentAnswer += " " + cleanTranscriptText(trimmedLine);
      } else if (lastRole === "AI" && currentQuestion) {
        // Continuation of AI question (multi-line)
        currentQuestion += " " + cleanTranscriptText(trimmedLine);
      }
    }
  }

  // Don't forget the last Q&A pair
  if (currentQuestion && currentAnswer.trim()) {
    questions.push({
      question: cleanTranscriptText(currentQuestion),
      answer: cleanTranscriptText(currentAnswer.trim()),
      questionNumber: questionNumber++,
    });
  }

  // Post-process: Clean up and validate Q&A pairs
  const validatedQuestions: QuestionAnswerPair[] = [];
  for (const qa of questions) {
    // Only include if both question and answer have meaningful content
    if (qa.question.trim().length >= 10 && qa.answer.trim().length >= 5) {
      // Further clean the question and answer
      qa.question = cleanTranscriptText(qa.question);
      qa.answer = cleanTranscriptText(qa.answer);
      validatedQuestions.push(qa);
    } else {
      console.log(`[TranscriptParser] Skipping incomplete Q&A pair: Q="${qa.question.substring(0, 50)}..." A="${qa.answer.substring(0, 50)}..."`);
    }
  }

  // If no Q&A pairs found but transcript exists, try alternative parsing
  // Sometimes transcripts have questions but student didn't complete answers
  if (validatedQuestions.length === 0 && lines.length > 0) {
    // Find all AI messages that are questions
    let questionsAsked = 0;
    for (const line of lines) {
      const aiMatch = line.trim().match(/^(?:AI|bot|assistant|examiner):\s*(.+)/i);
      if (aiMatch && containsQuestion(cleanTranscriptText(aiMatch[1]))) {
        questionsAsked++;
      }
    }

    // If questions were asked but no complete Q&A pairs, note this
    if (questionsAsked > 0) {
      console.log(`[TranscriptParser] Found ${questionsAsked} questions but no complete Q&A pairs`);
      console.log(`[TranscriptParser] Transcript preview: ${cleanedTranscript.substring(0, 500)}`);
    }
  }

  console.log(`[TranscriptParser] Extracted ${validatedQuestions.length} validated Q&A pairs from ${lines.length} lines`);

  return {
    questions: validatedQuestions,
    conversation: cleanedTranscript,
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
