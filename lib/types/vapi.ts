// Vapi Webhook Payload Types

export interface VapiCallMetadata {
  studentEmail?: string;
  studentName?: string;
  subject?: string;
  topics?: string;
}

export interface VapiCall {
  id: string;
  assistantId: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  recordingUrl?: string;
  duration?: number;
  metadata?: VapiCallMetadata;
}

export interface VapiWebhookPayload {
  call: VapiCall;
  message?: any;
  functionCall?: any;
}

// Transcript parsing types
export interface QuestionAnswerPair {
  question: string;
  answer: string;
  questionNumber: number;
}

export interface ParsedTranscript {
  questions: QuestionAnswerPair[];
  conversation: string;
}

// Evaluation types
export interface EvaluationMarks {
  questionNumber: number;
  question: string;
  answer: string;
  marks: number; // 0-10: 0-2 (no answer/poor), 3-4 (minimal), 5-6 (basic), 7-8 (good), 9-10 (excellent)
  maxMarks: number;
}

export interface EvaluationFeedback {
  questionNumber: number;
  feedback: string;
  strengths?: string[];
  weaknesses?: string[];
}

export interface VivaEvaluation {
  marks: EvaluationMarks[];
  feedback: EvaluationFeedback[];
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  overallFeedback: string;
}

// Google Sheets row data
export interface VivaSheetRow {
  timestamp: string;
  callId: string;
  studentEmail: string;
  studentName: string;
  subject: string;
  topics: string;
  duration: number;
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  transcript: string;
  recordingUrl?: string;
  evaluation: string; // JSON stringified evaluation
}
