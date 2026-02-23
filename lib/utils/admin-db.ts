import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.ADMIN_DATABASE_URL;
    if (!connectionString) {
      throw new Error("ADMIN_DATABASE_URL is not set");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export interface VivaResultRow {
  timestamp: string;
  student_name: string;
  student_email: string;
  subject: string;
  topics: string;
  questions_answered: number;
  score: number;
  overall_feedback: string;
  transcript: string;
  recording_url: string;
  evaluation: any;
  vapi_call_id: string;
  teacher_email: string;
  marks_breakdown: any;
}

function normalizeEmail(email: string | null | undefined): string {
  const trimmed = (email || "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "unknown@example.com";
}

function normalizeEvaluation(evaluation: any): string {
  if (!evaluation) return JSON.stringify({});
  if (typeof evaluation === "string") {
    try {
      JSON.parse(evaluation);
      return evaluation;
    } catch {
      return JSON.stringify({});
    }
  }
  return JSON.stringify(evaluation);
}

function normalizeMarksBreakdown(marks: any): string {
  if (!marks) return JSON.stringify([]);
  if (typeof marks === "string") {
    try {
      const parsed = JSON.parse(marks);
      if (Array.isArray(parsed)) return marks;
      return JSON.stringify([]);
    } catch {
      return JSON.stringify([]);
    }
  }
  if (Array.isArray(marks)) return JSON.stringify(marks);
  if (typeof marks === "object" && !Array.isArray(marks)) {
    return JSON.stringify([]);
  }
  return JSON.stringify([]);
}

export async function saveToAdminDb(data: VivaResultRow): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getPool();

    const studentEmail = normalizeEmail(data.student_email);
    const evaluationJson = normalizeEvaluation(data.evaluation);
    let marksBreakdownJson = normalizeMarksBreakdown(data.marks_breakdown);

    if (!marksBreakdownJson || marksBreakdownJson === 'null' || marksBreakdownJson === 'undefined') {
      marksBreakdownJson = JSON.stringify([]);
    }

    await db.query(
      `INSERT INTO viva_results 
        (timestamp, student_name, student_email, subject, topics, questions_answered, score, overall_feedback, transcript, recording_url, evaluation, vapi_call_id, teacher_email, marks_breakdown, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (vapi_call_id) DO UPDATE SET
        student_name = EXCLUDED.student_name,
        student_email = EXCLUDED.student_email,
        subject = EXCLUDED.subject,
        topics = EXCLUDED.topics,
        questions_answered = EXCLUDED.questions_answered,
        score = EXCLUDED.score,
        overall_feedback = EXCLUDED.overall_feedback,
        transcript = EXCLUDED.transcript,
        recording_url = EXCLUDED.recording_url,
        evaluation = EXCLUDED.evaluation,
        teacher_email = EXCLUDED.teacher_email,
        marks_breakdown = EXCLUDED.marks_breakdown`,
      [
        data.timestamp,
        data.student_name,
        studentEmail,
        data.subject,
        data.topics,
        data.questions_answered,
        data.score,
        data.overall_feedback,
        data.transcript,
        data.recording_url,
        evaluationJson,
        data.vapi_call_id,
        data.teacher_email,
        marksBreakdownJson,
      ]
    );

    return { success: true };
  } catch (error) {
    console.error("[Admin DB] Error saving result:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getAdminDbResultCount(): Promise<number> {
  const db = getPool();
  const result = await db.query("SELECT COUNT(*) FROM viva_results");
  return parseInt(result.rows[0].count, 10);
}

export async function lookupTeacherEmail(subjectName: string): Promise<string> {
  try {
    const db = getPool();
    const result = await db.query(
      "SELECT teacher_email FROM subjects WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND status = 'active' LIMIT 1",
      [subjectName]
    );
    if (result.rows[0]?.teacher_email) {
      return result.rows[0].teacher_email;
    }
    const fuzzy = await db.query(
      "SELECT teacher_email FROM subjects WHERE LOWER(TRIM(name)) LIKE '%' || LOWER(TRIM($1)) || '%' AND status = 'active' AND teacher_email IS NOT NULL AND teacher_email != '' LIMIT 1",
      [subjectName]
    );
    return fuzzy.rows[0]?.teacher_email || "";
  } catch {
    return "";
  }
}

export async function getTeacherEmailMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  try {
    const db = getPool();
    const result = await db.query("SELECT name, teacher_email FROM subjects WHERE status = 'active'");
    for (const row of result.rows) {
      if (row.name && row.teacher_email) {
        map[row.name.toLowerCase().trim()] = row.teacher_email;
      }
    }
  } catch (err) {
    console.error("[Admin DB] Error fetching teacher email map:", err);
  }
  return map;
}
