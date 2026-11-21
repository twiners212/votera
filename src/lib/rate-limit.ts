import { NextResponse } from "next/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  layer?: "voterIdentity" | "ip" | "user" | "global";
}

export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  nowMs?: number;
}

export interface VoterLoginRateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  ipMaxRequests?: number;
  ipWindowMs?: number;
  nowMs?: number;
}

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_STORE_ENTRIES = 5_000;

// Central in-memory sliding-window store: key -> array of request timestamps (epoch ms)
const requestLogStore = new Map<string, number[]>();

/**
 * Prunes expired timestamps across the store to prevent memory leaks.
 */
export function pruneExpiredKeys(now: number, maxWindowMs: number = DEFAULT_WINDOW_MS): void {
  const cutoff = now - maxWindowMs;
  for (const [key, timestamps] of requestLogStore.entries()) {
    const active = timestamps.filter((ts) => ts > cutoff);
    if (active.length === 0) {
      requestLogStore.delete(key);
    } else if (active.length !== timestamps.length) {
      requestLogStore.set(key, active);
    }
  }
}

/**
 * Extracts client IP from Request headers (X-Forwarded-For or X-Real-IP).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .find(Boolean);
    if (firstIp) {
      return firstIp.slice(0, 64);
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 64);
  }

  return "::1";
}

/**
 * Generic sliding-window rate limit evaluator.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.nowMs ?? Date.now();
  const cutoff = now - windowMs;

  if (requestLogStore.size > MAX_STORE_ENTRIES) {
    pruneExpiredKeys(now, Math.max(windowMs, 300_000));
  }

  const existing = requestLogStore.get(key) ?? [];
  const activeTimestamps = existing.filter((ts) => ts > cutoff);

  if (activeTimestamps.length >= maxRequests) {
    const oldestActive = activeTimestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestActive + windowMs - now) / 1000)
    );
    requestLogStore.set(key, activeTimestamps);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  activeTimestamps.push(now);
  requestLogStore.set(key, activeTimestamps);

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - activeTimestamps.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Generates standard rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After).
 */
export function createRateLimitHeaders(
  result: RateLimitResult,
  limit: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };

  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }

  return headers;
}

/**
 * Builds standardized HTTP 429 RATE_LIMIT_EXCEEDED JSON response per docs/API.md.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  limit: number,
  customMessage?: string
): NextResponse {
  const message =
    customMessage ??
    `Terlalu banyak permintaan. Silakan coba lagi dalam ${result.retryAfterSeconds} detik.`;

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
        details: {
          retryAfterSeconds: result.retryAfterSeconds,
        },
      },
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result, limit),
    }
  );
}

/**
 * Layered rate limiter for voter login:
 * - Layer 2 (Pure IP): max 120 req/60s (prevents mass NIS enumeration while safe for school NAT)
 * - Layer 1 (IP + voterIdentity): max 10 req/60s (prevents token brute-force per NIS)
 */
export function checkVoterLoginRateLimit(
  ipAddress: string,
  voterIdentity: string,
  options: VoterLoginRateLimitOptions = {}
): RateLimitResult {
  const now = options.nowMs ?? Date.now();
  const normalizedIp = (ipAddress || "::1").trim().toLowerCase();
  const normalizedIdentity = voterIdentity.trim().toLowerCase();

  // Layer 2: IP-wide anti-enumeration limit (default: 120 req / 60s)
  const ipMaxRequests = options.ipMaxRequests ?? 120;
  const ipWindowMs = options.ipWindowMs ?? DEFAULT_WINDOW_MS;
  const ipKey = `voter:login:ip:${normalizedIp}`;

  const ipResult = checkRateLimit(ipKey, {
    maxRequests: ipMaxRequests,
    windowMs: ipWindowMs,
    nowMs: now,
  });

  if (!ipResult.allowed) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: ipResult.retryAfterSeconds,
      layer: "ip",
    };
  }

  // Layer 1: Specific IP + voterIdentity limit (default: 10 req / 60s)
  const compositeKey = `${normalizedIp}:${normalizedIdentity}`;
  const compositeMax = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const compositeWindow = options.windowMs ?? DEFAULT_WINDOW_MS;

  const compositeResult = checkRateLimit(compositeKey, {
    maxRequests: compositeMax,
    windowMs: compositeWindow,
    nowMs: now,
  });

  if (!compositeResult.allowed) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: compositeResult.retryAfterSeconds,
      layer: "voterIdentity",
    };
  }

  return {
    allowed: true,
    remaining: compositeResult.remaining,
    retryAfterSeconds: 0,
  };
}

/**
 * Vote submission rate limiter: max 15 req/60s per voterId.
 * Allows 10 concurrent requests for TC-02 race condition verification.
 */
export function checkVoteSubmissionRateLimit(
  voterId: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const key = `voter:vote:${voterId}`;
  return checkRateLimit(key, {
    maxRequests: options.maxRequests ?? 15,
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    nowMs: options.nowMs,
  });
}

/**
 * Admin copy token rate limiter: max 30 req/60s per admin user.
 */
export function checkAdminCopyTokenRateLimit(
  adminUserId: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const key = `admin:copy-token:${adminUserId}`;
  return checkRateLimit(key, {
    maxRequests: options.maxRequests ?? 30,
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    nowMs: options.nowMs,
  });
}

/**
 * Admin reset token rate limiter: max 15 req/60s per admin user.
 */
export function checkAdminResetTokenRateLimit(
  adminUserId: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const key = `admin:reset-token:${adminUserId}`;
  return checkRateLimit(key, {
    maxRequests: options.maxRequests ?? 15,
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    nowMs: options.nowMs,
  });
}

/**
 * Admin bulk DPT import rate limiter: max 3 req/60s per admin user.
 */
export function checkAdminImportRateLimit(
  adminUserId: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const key = `admin:import:${adminUserId}`;
  return checkRateLimit(key, {
    maxRequests: options.maxRequests ?? 3,
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    nowMs: options.nowMs,
  });
}

/**
 * Admin candidate photo upload rate limiter: max 10 req/300s (5 minutes) per admin user.
 */
export function checkAdminUploadRateLimit(
  adminUserId: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const key = `admin:upload:${adminUserId}`;
  return checkRateLimit(key, {
    maxRequests: options.maxRequests ?? 10,
    windowMs: options.windowMs ?? 300_000,
    nowMs: options.nowMs,
  });
}

/**
 * Public endpoints rate limiter: max 60 req/60s per client IP.
 */
export function checkPublicEndpointRateLimit(
  endpointName: string,
  ipAddress: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const normalizedIp = (ipAddress || "::1").trim().toLowerCase();
  const key = `public:${endpointName}:${normalizedIp}`;
  return checkRateLimit(key, {
    maxRequests: options.maxRequests ?? 60,
    windowMs: options.windowMs ?? DEFAULT_WINDOW_MS,
    nowMs: options.nowMs,
  });
}

/**
 * Resets all rate limit tracking stores.
 */
export function resetAllRateLimits(): void {
  requestLogStore.clear();
}

/**
 * Alias for test suite backward compatibility.
 */
export function resetVoterLoginRateLimits(): void {
  resetAllRateLimits();
}

/**
 * Internal helper for testing store size.
 */
export function getRateLimitStoreSize(): number {
  return requestLogStore.size;
}
