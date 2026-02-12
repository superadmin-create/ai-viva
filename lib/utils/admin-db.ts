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

export async function saveToAdminDb(data: VivaResultRow): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getPool();

    const existing = await db.query(
      "SELECT id FROM viva_results WHERE vapi_call_id = $1",
      [data.vapi_call_id]
    );

    if (existing.rows.length > 0) {
      return { success: true, error: "Record already exists in admin database" };
    }

    await db.query(
      `INSERT INTO viva_results 
        (timestamp, student_name, student_email, subject, topics, questions_answered, score, overall_feedback, transcript, recording_url, evaluation, vapi_call_id, teacher_email, marks_breakdown, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
      [
        data.timestamp,
        data.student_name,
        data.student_email,
        data.subject,
        data.topics,
        data.questions_answered,
        data.score,
        data.overall_feedback,
        data.transcript,
        data.recording_url,
        JSON.stringify(data.evaluation),
        data.vapi_call_id,
        data.teacher_email,
        JSON.stringify(data.marks_breakdown),
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
