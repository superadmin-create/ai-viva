import { NextResponse } from "next/server";
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

export async function GET() {
  try {
    const db = getPool();
    const result = await db.query(
      "SELECT name, teacher_email FROM subjects WHERE status = 'active' ORDER BY name"
    );

    const subjects = result.rows.map((row) => ({
      name: row.name,
      teacherEmail: row.teacher_email || "",
    }));

    console.log(`[Subjects API] Found ${subjects.length} subjects from admin database`);

    return NextResponse.json({
      success: true,
      subjects,
      source: "admin_db",
    });
  } catch (error) {
    console.error("[Subjects API] Error fetching subjects from admin DB:", error);
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}
