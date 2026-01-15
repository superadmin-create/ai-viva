/**
 * API endpoint to fetch actual call logs from VAPI
 * 
 * Usage:
 *   GET /api/fetch-vapi-calls?limit=10&status=ended
 *   GET /api/fetch-vapi-calls?callId=call_abc123
 */

import { NextResponse } from "next/server";

const VAPI_API_BASE = "https://api.vapi.ai";

interface VapiCall {
  id: string;
  assistantId: string;
  status: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  recordingUrl?: string;
  duration?: number;
  metadata?: Record<string, any>;
  messages?: any[];
  artifact?: {
    transcript?: string;
    messages?: any[];
    recordingUrl?: string;
  };
}

/**
 * Fetch calls from VAPI API
 */
async function fetchVapiCalls(params: {
  callId?: string;
  limit?: number;
  status?: string;
  assistantId?: string;
}): Promise<VapiCall[]> {
  const privateKey = process.env.VAPI_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("VAPI_PRIVATE_KEY is not set in environment variables");
  }

  const { callId, limit = 10, status, assistantId } = params;

  // If specific call ID is provided, fetch that call
  if (callId) {
    const response = await fetch(`${VAPI_API_BASE}/call/${callId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${privateKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch call: ${response.status} ${errorText}`);
    }

    const call = await response.json();
    return [call];
  }

  // Otherwise, fetch list of calls
  // Note: VAPI API may have different parameter names - try without status filter first
  const queryParams = new URLSearchParams();
  if (limit) queryParams.append("limit", limit.toString());
  // Note: status filter might need to be applied client-side or use different endpoint
  if (assistantId) queryParams.append("assistantId", assistantId);

  const url = `${VAPI_API_BASE}/call${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${privateKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch calls: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  // VAPI API might return { calls: [...] } or just an array
  return Array.isArray(data) ? data : data.calls || data.data || [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status") || undefined;
    const assistantId = searchParams.get("assistantId") || undefined;

    console.log("[Fetch VAPI Calls] Fetching calls with params:", {
      callId,
      limit,
      status,
      assistantId,
    });

    const calls = await fetchVapiCalls({
      callId: callId || undefined,
      limit,
      status: undefined, // Don't pass status to API, filter client-side
      assistantId,
    });

    console.log(`[Fetch VAPI Calls] Retrieved ${calls.length} call(s)`);

    // Filter by status client-side if provided
    let filteredCalls = calls;
    if (status) {
      filteredCalls = calls.filter((call) => call.status === status);
      console.log(`[Fetch VAPI Calls] Filtered to ${filteredCalls.length} call(s) with status: ${status}`);
    }

    // Format the response with detailed information
    const formattedCalls = filteredCalls.map((call) => ({
      id: call.id,
      assistantId: call.assistantId,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      duration: call.duration,
      hasTranscript: !!(call.transcript || call.artifact?.transcript || call.artifact?.messages),
      transcriptLength: call.transcript?.length || call.artifact?.transcript?.length || 0,
      hasRecording: !!call.recordingUrl || !!call.artifact?.recordingUrl,
      recordingUrl: call.recordingUrl || call.artifact?.recordingUrl,
      metadata: call.metadata,
      messageCount: call.artifact?.messages?.length || call.messages?.length || 0,
      // Include full transcript if available (truncated for large ones)
      transcript: call.transcript || call.artifact?.transcript || null,
      // Include messages if available
      messages: call.artifact?.messages || call.messages || null,
    }));

    return NextResponse.json({
      success: true,
      count: formattedCalls.length,
      totalRetrieved: calls.length,
      calls: formattedCalls,
    });
  } catch (error) {
    console.error("[Fetch VAPI Calls] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
