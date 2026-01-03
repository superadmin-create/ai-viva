/**
 * OTP Storage with Vercel KV (Redis) support and in-memory fallback
 * Uses Vercel KV in production for persistence across serverless instances
 * Falls back to in-memory storage for local development
 */

interface OTPData {
  otp: string;
  expiresAt: number;
  email: string;
}

// Key prefix for OTP storage
const OTP_KEY_PREFIX = "otp:";

// Check if Vercel KV is configured
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// ============= Vercel KV Implementation =============
async function kvStoreOTP(
  normalizedEmail: string,
  otp: string,
  ttlSeconds: number
): Promise<void> {
  const { kv } = await import("@vercel/kv");
  const key = `${OTP_KEY_PREFIX}${normalizedEmail}`;
  const data: OTPData = {
    otp: otp.trim(),
    expiresAt: Date.now() + ttlSeconds * 1000,
    email: normalizedEmail,
  };

  await kv.set(key, data, { ex: ttlSeconds });
  console.log(`[OTP Storage KV] Stored OTP for: ${normalizedEmail}, TTL: ${ttlSeconds}s`);
}

async function kvGetOTP(normalizedEmail: string): Promise<OTPData | null> {
  const { kv } = await import("@vercel/kv");
  const key = `${OTP_KEY_PREFIX}${normalizedEmail}`;
  const data = await kv.get<OTPData>(key);

  if (!data) {
    console.log(`[OTP Storage KV] No OTP found for: ${normalizedEmail}`);
    return null;
  }

  // Double-check expiration
  if (data.expiresAt < Date.now()) {
    await kv.del(key);
    console.log(`[OTP Storage KV] OTP expired for: ${normalizedEmail}`);
    return null;
  }

  return data;
}

async function kvClearOTP(normalizedEmail: string): Promise<void> {
  const { kv } = await import("@vercel/kv");
  const key = `${OTP_KEY_PREFIX}${normalizedEmail}`;
  await kv.del(key);
  console.log(`[OTP Storage KV] Cleared OTP for: ${normalizedEmail}`);
}

// ============= In-Memory Fallback Implementation =============
declare global {
  // eslint-disable-next-line no-var
  var __otpStorage: Map<string, OTPData> | undefined;
  // eslint-disable-next-line no-var
  var __otpCleanupInitialized: boolean | undefined;
}

function getMemoryStorage(): Map<string, OTPData> {
  if (!globalThis.__otpStorage) {
    globalThis.__otpStorage = new Map<string, OTPData>();
    console.log("[OTP Storage Memory] Initialized new in-memory storage");
  }
  return globalThis.__otpStorage;
}

// Initialize cleanup interval for in-memory storage
if (typeof globalThis.__otpCleanupInitialized === "undefined") {
  globalThis.__otpCleanupInitialized = true;
  setInterval(() => {
    const storage = getMemoryStorage();
    const now = Date.now();
    let cleanedCount = 0;
    const entries = Array.from(storage.entries());
    for (const [email, data] of entries) {
      if (data.expiresAt < now) {
        storage.delete(email);
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      console.log(`[OTP Storage Memory] Cleaned up ${cleanedCount} expired OTPs`);
    }
  }, 60000);
}

function memoryStoreOTP(
  normalizedEmail: string,
  otp: string,
  expiresInMs: number
): void {
  const storage = getMemoryStorage();
  storage.set(normalizedEmail, {
    otp: otp.trim(),
    expiresAt: Date.now() + expiresInMs,
    email: normalizedEmail,
  });
  console.log(`[OTP Storage Memory] Stored OTP for: ${normalizedEmail}`);
}

function memoryGetOTP(normalizedEmail: string): OTPData | null {
  const storage = getMemoryStorage();
  const data = storage.get(normalizedEmail);

  if (!data) {
    console.log(`[OTP Storage Memory] No OTP found for: ${normalizedEmail}`);
    return null;
  }

  if (data.expiresAt < Date.now()) {
    storage.delete(normalizedEmail);
    console.log(`[OTP Storage Memory] OTP expired for: ${normalizedEmail}`);
    return null;
  }

  return data;
}

function memoryClearOTP(normalizedEmail: string): void {
  const storage = getMemoryStorage();
  storage.delete(normalizedEmail);
  console.log(`[OTP Storage Memory] Cleared OTP for: ${normalizedEmail}`);
}

// ============= Public API =============

/**
 * Store OTP with automatic expiration
 */
export async function storeOTP(
  email: string,
  otp: string,
  expiresInMs: number = 5 * 60 * 1000
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOTP = otp.trim();
  const ttlSeconds = Math.ceil(expiresInMs / 1000);

  if (isKVConfigured()) {
    await kvStoreOTP(normalizedEmail, normalizedOTP, ttlSeconds);
  } else {
    memoryStoreOTP(normalizedEmail, normalizedOTP, expiresInMs);
    console.warn("[OTP Storage] Using in-memory storage - configure KV_REST_API_URL and KV_REST_API_TOKEN for production");
  }
}

/**
 * Get OTP data
 */
export async function getOTP(email: string): Promise<OTPData | null> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isKVConfigured()) {
    return await kvGetOTP(normalizedEmail);
  } else {
    return memoryGetOTP(normalizedEmail);
  }
}

/**
 * Verify OTP and clear it if valid
 */
export async function verifyAndClearOTP(
  email: string,
  otp: string
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedInputOTP = otp.trim();

  console.log(`[OTP Storage] Verifying OTP for: ${normalizedEmail}, using KV: ${isKVConfigured()}`);

  try {
    const data = await getOTP(normalizedEmail);
    if (!data) {
      console.log(`[OTP Storage] No OTP found for: ${normalizedEmail}`);
      return false;
    }

    const normalizedStoredOTP = data.otp.trim();
    console.log(`[OTP Storage] Comparing OTP - stored: "${normalizedStoredOTP}", input: "${normalizedInputOTP}"`);

    if (normalizedStoredOTP === normalizedInputOTP) {
      await clearOTP(normalizedEmail);
      console.log(`[OTP Storage] OTP verified and cleared for: ${normalizedEmail}`);
      return true;
    }

    console.log(`[OTP Storage] OTP mismatch for: ${normalizedEmail}`);
    return false;
  } catch (error) {
    console.error("[OTP Storage] Error verifying OTP:", error);
    return false;
  }
}

/**
 * Clear OTP
 */
export async function clearOTP(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isKVConfigured()) {
    await kvClearOTP(normalizedEmail);
  } else {
    memoryClearOTP(normalizedEmail);
  }
}

/**
 * Debug function to check storage status
 */
export async function debugOTPStorage(): Promise<{
  usingKV: boolean;
  connected: boolean;
  error?: string;
}> {
  const usingKV = isKVConfigured();

  if (usingKV) {
    try {
      const { kv } = await import("@vercel/kv");
      await kv.ping();
      return { usingKV: true, connected: true };
    } catch (error) {
      return {
        usingKV: true,
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  return { usingKV: false, connected: true };
}
