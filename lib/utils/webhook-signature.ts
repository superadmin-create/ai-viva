/**
 * Verify Vapi webhook signature for security
 * Vapi signs webhook payloads - we need to verify the signature
 */

import crypto from "crypto";

/**
 * Verify webhook signature from Vapi
 * 
 * @param payload - The raw request body as string
 * @param signature - The signature from the X-Vapi-Signature header
 * @param secret - The webhook secret from Vapi dashboard
 * @returns true if signature is valid
 */
export function verifyVapiWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.warn("[Webhook] No signature provided");
    return false;
  }

  if (!secret) {
    console.warn("[Webhook] Webhook secret not configured");
    return false;
  }

  try {
    // Vapi typically uses HMAC SHA256
    // The signature format might be: sha256=<hash>
    // Extract the hash if it's prefixed
    const hash = signature.includes("=") 
      ? signature.split("=")[1] 
      : signature;

    // Create HMAC hash
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Compare signatures using constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    console.error("[Webhook] Error verifying signature:", error);
    return false;
  }
}
