import { NextResponse } from "next/server";
import { Resend } from "resend";
import { storeOTP, getOTP, clearOTP } from "@/lib/utils/otp-storage";
import { getOTPEmailHTML, getOTPEmailText } from "@/lib/utils/email-templates";

// Lazy initialization to avoid build-time errors when API key is not set
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email
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

    // Check if RESEND_API_KEY is configured
    const resendClient = getResendClient();
    if (!resendClient) {
      console.error("RESEND_API_KEY is not configured");
      return NextResponse.json(
        { error: "Email service is not configured" },
        { status: 500 }
      );
    }

    // Normalize email for checking
    const normalizedEmail = email.trim().toLowerCase();

    // Check if there's an existing OTP that hasn't expired (async now)
    const existingOTP = await getOTP(normalizedEmail);
    if (existingOTP) {
      console.log(`[Send OTP] OTP already exists for ${normalizedEmail}, rate limiting`);
      // Rate limiting: don't send a new OTP if one exists and hasn't expired
      return NextResponse.json(
        {
          error: "An OTP has already been sent. Please wait before requesting a new one.",
        },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP with 5 minute expiration (async now)
    await storeOTP(normalizedEmail, otp, 5 * 60 * 1000);
    console.log(`[Send OTP] OTP stored for ${normalizedEmail}`);

    // Send email
    try {
      // Use environment variable for from email, fallback to Resend default
      const fromEmail = process.env.RESEND_FROM_EMAIL || "AI Viva <onboarding@resend.dev>";

      const { data, error } = await resendClient.emails.send({
        from: fromEmail,
        to: email,
        subject: "Your Viva Verification Code",
        html: getOTPEmailHTML(otp),
        text: getOTPEmailText(otp),
      });

      if (error) {
        console.error("Resend API error:", error);
        // Clear the stored OTP if email sending failed
        await clearOTP(normalizedEmail);
        return NextResponse.json(
          { error: "Failed to send email" },
          { status: 500 }
        );
      }

      console.log("OTP email sent successfully:", data);

      return NextResponse.json({
        success: true,
        message: "OTP sent successfully",
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      // Clear the stored OTP if email sending failed
      await clearOTP(normalizedEmail);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in send-otp route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
