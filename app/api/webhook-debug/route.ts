/**
 * Debug endpoint to log all incoming webhook requests
 * This helps verify that VAPI webhooks are reaching the server
 * 
 * Usage: Configure this as a webhook URL in VAPI dashboard temporarily
 * to see what format they're sending
 */

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const timestamp = new Date().toISOString();
  
  try {
    const rawBody = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    
    console.log("=".repeat(80));
    console.log("[Webhook Debug] ===== INCOMING WEBHOOK =====");
    console.log("[Webhook Debug] Timestamp:", timestamp);
    console.log("[Webhook Debug] URL:", request.url);
    console.log("[Webhook Debug] Method:", request.method);
    console.log("[Webhook Debug] Headers:", JSON.stringify(headers, null, 2));
    console.log("[Webhook Debug] Body length:", rawBody.length);
    console.log("[Webhook Debug] Raw body:", rawBody);
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
      console.log("[Webhook Debug] Parsed body:", JSON.stringify(parsedBody, null, 2));
      console.log("[Webhook Debug] Body keys:", Object.keys(parsedBody));
      
      // Check for call data in various locations
      const callLocations = {
        "body.call": parsedBody.call,
        "body.message": parsedBody.message,
        "body.message.call": parsedBody.message?.call,
        "body.data": parsedBody.data,
        "body.event": parsedBody.event,
      };
      
      console.log("[Webhook Debug] Call data locations:");
      for (const [location, data] of Object.entries(callLocations)) {
        if (data) {
          console.log(`  ✓ Found at ${location}:`, {
            hasId: !!data.id || !!(data as any)?.call?.id,
            hasStatus: !!data.status || !!(data as any)?.call?.status,
            hasTranscript: !!(data as any)?.transcript || !!(data as any)?.call?.transcript,
            keys: Object.keys(data),
          });
        }
      }
    } catch (parseError) {
      console.error("[Webhook Debug] Failed to parse body as JSON:", parseError);
    }
    
    console.log("[Webhook Debug] ===== END WEBHOOK DEBUG =====");
    console.log("=".repeat(80));
    
    // Always return 200 to acknowledge receipt
    return NextResponse.json({
      received: true,
      timestamp,
      message: "Webhook received and logged",
    });
  } catch (error) {
    console.error("[Webhook Debug] Error processing webhook:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Webhook Debug Endpoint",
    usage: "Configure this URL in VAPI dashboard to see webhook format",
    endpoint: "/api/webhook-debug",
  });
}
