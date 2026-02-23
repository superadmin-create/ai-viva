import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

interface VivaQuestion {
  id: number;
  question: string;
  expectedAnswer: string;
  difficulty: string;
  topic: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");
    const topic = searchParams.get("topic");

    if (!subject) {
      return NextResponse.json(
        { error: "Subject parameter is required" },
        { status: 400 }
      );
    }

    const db = getPool();

    let query: string;
    let params: string[];

    if (topic && topic !== "all") {
      query = `SELECT id, question, expected_answer, difficulty, topics 
               FROM viva_questions 
               WHERE LOWER(TRIM(subject)) = LOWER(TRIM($1)) 
                 AND active = true 
                 AND LOWER(topics) LIKE '%' || LOWER(TRIM($2)) || '%'
               ORDER BY id`;
      params = [subject, topic];
    } else {
      query = `SELECT id, question, expected_answer, difficulty, topics 
               FROM viva_questions 
               WHERE LOWER(TRIM(subject)) = LOWER(TRIM($1)) 
                 AND active = true 
               ORDER BY id`;
      params = [subject];
    }

    const result = await db.query(query, params);

    const questions: VivaQuestion[] = result.rows.map((row) => ({
      id: row.id,
      question: row.question,
      expectedAnswer: row.expected_answer || "",
      difficulty: row.difficulty || "medium",
      topic: row.topics || "",
    }));

    console.log(`[Get Questions] Found ${questions.length} questions for subject: ${subject}${topic ? `, topic: ${topic}` : ""} from admin database`);

    if (questions.length > 0) {
      console.log(`[Get Questions] Sample question: ${questions[0].question.substring(0, 100)}...`);
    }

    return NextResponse.json({
      success: true,
      subject,
      topic,
      questions,
      count: questions.length,
      source: "admin_db",
    });
  } catch (error) {
    console.error("[Get Questions] Error fetching from admin DB:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}
