import { NextResponse } from "next/server";
import { verifyStudent } from "@/lib/api/edmingle";
import type { EdmingleVerifyStudentResponse } from "@/lib/types/edmingle";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, batchId } = body;

    // Validate inputs
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Verify student with Edmingle LMS
    try {
      const result: EdmingleVerifyStudentResponse = await verifyStudent(
        email,
        batchId
      );

      if (result.verified && result.studentData) {
        return NextResponse.json({
          verified: true,
          studentData: {
            name: result.studentData.fullName || 
              `${result.studentData.firstName} ${result.studentData.lastName}`.trim(),
            email: result.studentData.email,
            enrolledCourses: result.studentData.enrolledCourses || [],
            batchId: result.studentData.batchId,
            courseId: result.studentData.courseId,
          },
        });
      }

      return NextResponse.json(
        {
          verified: false,
          error: "Student not found in the system",
        },
        { status: 404 }
      );
    } catch (error) {
      console.error("Error verifying student with Edmingle:", error);

      // Check if it's a configuration error
      if (error instanceof Error && error.message.includes("not configured")) {
        console.error("[Verify Student] Configuration error - check EDMINGLE_API_KEY in .env");
        return NextResponse.json(
          {
            verified: false,
            error: "LMS service is not configured. Please contact administrator.",
          },
          { status: 503 }
        );
      }

      // Check if it's a connection error
      if (error instanceof Error && error.message.includes("Unable to connect")) {
        console.error("[Verify Student] Connection error to Edmingle API");
        return NextResponse.json(
          {
            verified: false,
            error: "Unable to connect to student database. Please try again later.",
          },
          { status: 503 }
        );
      }

      // Check if it's a student not found error (404, 400 with "No such user", etc.)
      // Edmingle returns: { "code": 10004, "message": "No such user." } with status 400
      if (error instanceof Error && 
          (error.message.includes("404") || 
           error.message.includes("Not Found") ||
           error.message.includes("No such user"))) {
        return NextResponse.json(
          {
            verified: false,
            error: "Student not found in the system",
          },
          { status: 404 }
        );
      }

      // Other API errors
      return NextResponse.json(
        {
          verified: false,
          error: "Failed to verify student. Please try again later.",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in verify-student route:", error);
    return NextResponse.json(
      {
        verified: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
