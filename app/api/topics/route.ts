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
    });
  }
  return pool;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");

    if (!subject) {
      return NextResponse.json(
        { error: "Subject parameter is required" },
        { status: 400 }
      );
    }

    const db = getPool();
    const result = await db.query(
      "SELECT name FROM topics WHERE LOWER(TRIM(subject_name)) = LOWER(TRIM($1)) AND status = 'active' ORDER BY name",
      [subject]
    );

    const topics = result.rows.map((row) => row.name);

    console.log(`[Topics API] Found ${topics.length} topics for subject: ${subject} from admin database`);

    return NextResponse.json({
      success: true,
      subject,
      topics,
      count: topics.length,
      source: "admin_db",
    });
  } catch (error) {
    console.error("[Topics API] Error fetching topics from admin DB:", error);
    return NextResponse.json(
      { error: "Failed to fetch topics" },
      { status: 500 }
    );
  }
}
