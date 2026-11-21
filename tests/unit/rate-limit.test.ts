import { beforeEach, describe, expect, it } from "vitest";
import {
  checkAdminCopyTokenRateLimit,
  checkAdminImportRateLimit,
  checkAdminResetTokenRateLimit,
  checkAdminUploadRateLimit,
  checkPublicEndpointRateLimit,
  checkRateLimit,
  checkVoteSubmissionRateLimit,
  checkVoterLoginRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
  getClientIp,
  getRateLimitStoreSize,
  pruneExpiredKeys,
  resetAllRateLimits,
} from "@/lib/rate-limit";

describe("Centralized Sliding-Window Rate Limiter (src/lib/rate-limit.ts)", () => {
  beforeEach(() => {
    resetAllRateLimits();
  });

  describe("1. Core Sliding-Window Engine (checkRateLimit)", () => {
    it("allows requests up to maxRequests and accurately tracks remaining slots", () => {
      const key = "test:user:1";
      const limit = 5;
      const windowMs = 60_000;
      const baseTime = 1_000_000;

      for (let i = 1; i <= limit; i++) {
        const result = checkRateLimit(key, {
          maxRequests: limit,
          windowMs,
          nowMs: baseTime + i * 100,
        });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(limit - i);
        expect(result.retryAfterSeconds).toBe(0);
      }

      // The (limit + 1)-th request should be blocked
      const blocked = checkRateLimit(key, {
        maxRequests: limit,
        windowMs,
        nowMs: baseTime + 600,
      });
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("restores capacity as timestamps roll off the sliding window", () => {
      const key = "test:sliding:window";
      const limit = 3;
      const windowMs = 10_000; // 10 seconds
      const t0 = 100_000;

      // 3 requests at t0, t0 + 1s, t0 + 2s
      checkRateLimit(key, { maxRequests: limit, windowMs, nowMs: t0 });
      checkRateLimit(key, { maxRequests: limit, windowMs, nowMs: t0 + 1_000 });
      checkRateLimit(key, { maxRequests: limit, windowMs, nowMs: t0 + 2_000 });

      // At t0 + 5s, limit is reached
      const blockedAt5 = checkRateLimit(key, { maxRequests: limit, windowMs, nowMs: t0 + 5_000 });
      expect(blockedAt5.allowed).toBe(false);
      // Oldest request was at t0, window is 10s, so retryAfter is ceil((t0 + 10s - (t0 + 5s)) / 1000) = 5
      expect(blockedAt5.retryAfterSeconds).toBe(5);

      // At t0 + 10.5s, the first request at t0 has expired (t0 + 10.5s > t0 + 10s)
      const allowedAt10_5 = checkRateLimit(key, {
        maxRequests: limit,
        windowMs,
        nowMs: t0 + 10_500,
      });
      expect(allowedAt10_5.allowed).toBe(true);
      expect(allowedAt10_5.remaining).toBe(0); // 2 active remaining + 1 new = 3 used out of 3

      // At t0 + 25s, all previous requests have completely expired
      const freshResult = checkRateLimit(key, {
        maxRequests: limit,
        windowMs,
        nowMs: t0 + 25_000,
      });
      expect(freshResult.allowed).toBe(true);
      expect(freshResult.remaining).toBe(limit - 1);
    });
  });

  describe("2. Auto-Cleanup TTL & Memory Management", () => {
    it("prunes keys with no active timestamps", () => {
      const t0 = 100_000;
      const windowMs = 5_000;

      checkRateLimit("session:expired:1", { maxRequests: 5, windowMs, nowMs: t0 });
      checkRateLimit("session:expired:2", { maxRequests: 5, windowMs, nowMs: t0 + 1000 });
      checkRateLimit("session:active:3", { maxRequests: 5, windowMs, nowMs: t0 + 6000 });

      expect(getRateLimitStoreSize()).toBe(3);

      // Prune at t0 + 7000 ms with window 5000 ms (cutoff: t0 + 2000 ms)
      // session:expired:1 (t0 < cutoff) and session:expired:2 (t0 + 1000 < cutoff) are expired
      pruneExpiredKeys(t0 + 7_000, windowMs);

      expect(getRateLimitStoreSize()).toBe(1);
    });

    it("resets all rate limit stores completely via resetAllRateLimits", () => {
      checkRateLimit("test:1", { maxRequests: 5 });
      checkRateLimit("test:2", { maxRequests: 5 });
      expect(getRateLimitStoreSize()).toBe(2);

      resetAllRateLimits();
      expect(getRateLimitStoreSize()).toBe(0);
    });
  });

  describe("3. HTTP Headers & 429 Response Helpers", () => {
    it("creates standard rate limit headers for allowed and blocked requests", () => {
      const allowedHeaders = createRateLimitHeaders(
        { allowed: true, remaining: 8, retryAfterSeconds: 0 },
        10
      );
      expect(allowedHeaders["X-RateLimit-Limit"]).toBe("10");
      expect(allowedHeaders["X-RateLimit-Remaining"]).toBe("8");
      expect(allowedHeaders["Retry-After"]).toBeUndefined();

      const blockedHeaders = createRateLimitHeaders(
        { allowed: false, remaining: 0, retryAfterSeconds: 34 },
        10
      );
      expect(blockedHeaders["X-RateLimit-Limit"]).toBe("10");
      expect(blockedHeaders["X-RateLimit-Remaining"]).toBe("0");
      expect(blockedHeaders["Retry-After"]).toBe("34");
    });

    it("creates standardized HTTP 429 response matching docs/API.md specification", async () => {
      const response = createRateLimitResponse(
        { allowed: false, remaining: 0, retryAfterSeconds: 45 },
        10,
        "Terlalu banyak percobaan login. Silakan coba lagi nanti."
      );

      expect(response.status).toBe(429);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("Retry-After")).toBe("45");

      const body = await response.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
          details: {
            retryAfterSeconds: 45,
          },
        },
      });
    });
  });

  describe("4. Voter Login Layered Rate Limiting (POST /api/voter/login)", () => {
    it("Layer 1: restricts 10 requests per 60s per (ip + voterIdentity)", () => {
      const ip = "172.16.0.5";
      const voterIdentity = "2324001";

      for (let i = 1; i <= 10; i++) {
        const res = checkVoterLoginRateLimit(ip, voterIdentity);
        expect(res.allowed).toBe(true);
      }

      // 11th request for the same NIS from same IP is blocked
      const eleventh = checkVoterLoginRateLimit(ip, voterIdentity);
      expect(eleventh.allowed).toBe(false);
      expect(eleventh.layer).toBe("voterIdentity");
      expect(eleventh.retryAfterSeconds).toBeGreaterThanOrEqual(1);

      // A different NIS from the same IP (school Wi-Fi NAT) is NOT blocked
      const differentNis = checkVoterLoginRateLimit(ip, "2324002");
      expect(differentNis.allowed).toBe(true);
    });

    it("Layer 2: blocks pure IP when total login requests exceed 120 req/60s (mass enumeration defense)", () => {
      const sharedIp = "172.16.0.88";

      // 12 different NIS users each attempt 10 times = 120 total requests from this IP
      for (let voter = 1; voter <= 12; voter++) {
        const nis = `900${voter.toString().padStart(4, "0")}`;
        for (let attempt = 1; attempt <= 10; attempt++) {
          const res = checkVoterLoginRateLimit(sharedIp, nis);
          expect(res.allowed).toBe(true);
        }
      }

      // The 121st request from this IP (even with a brand-new 13th NIS) is blocked by Layer 2
      const enumeration121 = checkVoterLoginRateLimit(sharedIp, "9009999");
      expect(enumeration121.allowed).toBe(false);
      expect(enumeration121.layer).toBe("ip");
      expect(enumeration121.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });
  });

  describe("5. Voter Vote Submission Rate Limiting (POST /api/voter/vote)", () => {
    it("permits 10 concurrent requests to satisfy TC-02 race condition testing and caps at 15 req/60s per voterId", () => {
      const voterId = "voter-uuid-100";

      // 10 concurrent requests from TC-02 must all pass the rate limiter
      for (let i = 1; i <= 10; i++) {
        const res = checkVoteSubmissionRateLimit(voterId);
        expect(res.allowed).toBe(true);
        expect(res.remaining).toBe(15 - i);
      }

      // 5 additional requests also pass (total 15)
      for (let i = 11; i <= 15; i++) {
        const res = checkVoteSubmissionRateLimit(voterId);
        expect(res.allowed).toBe(true);
      }

      // 16th request is blocked
      const sixteenth = checkVoteSubmissionRateLimit(voterId);
      expect(sixteenth.allowed).toBe(false);
      expect(sixteenth.remaining).toBe(0);
      expect(sixteenth.retryAfterSeconds).toBeGreaterThanOrEqual(1);

      // Another voter is completely unaffected
      const otherVoter = checkVoteSubmissionRateLimit("voter-uuid-200");
      expect(otherVoter.allowed).toBe(true);
      expect(otherVoter.remaining).toBe(14);
    });
  });

  describe("6. Admin Token Security Rate Limiting", () => {
    it("limits copy-token to 30 req/60s per admin user", () => {
      const adminId = "admin-1";

      for (let i = 1; i <= 30; i++) {
        expect(checkAdminCopyTokenRateLimit(adminId).allowed).toBe(true);
      }

      const blocked = checkAdminCopyTokenRateLimit(adminId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

      // Different admin is not affected
      expect(checkAdminCopyTokenRateLimit("admin-2").allowed).toBe(true);
    });

    it("limits reset-token to 15 req/60s per admin user", () => {
      const adminId = "admin-1";

      for (let i = 1; i <= 15; i++) {
        expect(checkAdminResetTokenRateLimit(adminId).allowed).toBe(true);
      }

      const blocked = checkAdminResetTokenRateLimit(adminId);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });
  });

  describe("7. Admin Heavy Operations Rate Limiting", () => {
    it("limits bulk DPT import to 3 req/60s per admin user", () => {
      const adminId = "super-admin-import";

      for (let i = 1; i <= 3; i++) {
        expect(checkAdminImportRateLimit(adminId).allowed).toBe(true);
      }

      const fourth = checkAdminImportRateLimit(adminId);
      expect(fourth.allowed).toBe(false);
      expect(fourth.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });

    it("limits candidate photo upload to 10 req/300s (5 minutes) per admin user", () => {
      const adminId = "super-admin-upload";

      for (let i = 1; i <= 10; i++) {
        expect(checkAdminUploadRateLimit(adminId).allowed).toBe(true);
      }

      const eleventh = checkAdminUploadRateLimit(adminId);
      expect(eleventh.allowed).toBe(false);
      // Window is 300s, so retryAfter is up to 300s
      expect(eleventh.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(eleventh.retryAfterSeconds).toBeLessThanOrEqual(300);
    });
  });

  describe("8. Public Endpoints Rate Limiting (/api/public/election & /api/candidates)", () => {
    it("limits public endpoints to 60 req/60s per client IP", () => {
      const ip = "203.0.113.45";

      for (let i = 1; i <= 60; i++) {
        expect(checkPublicEndpointRateLimit("candidates", ip).allowed).toBe(true);
      }

      const blockedCandidates = checkPublicEndpointRateLimit("candidates", ip);
      expect(blockedCandidates.allowed).toBe(false);

      // Independent namespace for public election
      expect(checkPublicEndpointRateLimit("public-election", ip).allowed).toBe(true);

      // Independent IP quota
      expect(checkPublicEndpointRateLimit("candidates", "198.51.100.22").allowed).toBe(true);
    });
  });

  describe("9. Client IP Extraction (getClientIp)", () => {
    it("extracts the first IP from X-Forwarded-For header", () => {
      const req = new Request("http://localhost:3000/api/test", {
        headers: { "x-forwarded-for": "103.21.244.1, 10.0.0.1, 172.16.0.1" },
      });
      expect(getClientIp(req)).toBe("103.21.244.1");
    });

    it("extracts IP from X-Real-IP if X-Forwarded-For is missing", () => {
      const req = new Request("http://localhost:3000/api/test", {
        headers: { "x-real-ip": "192.168.1.100" },
      });
      expect(getClientIp(req)).toBe("192.168.1.100");
    });

    it("falls back to ::1 if no IP headers are present", () => {
      const req = new Request("http://localhost:3000/api/test");
      expect(getClientIp(req)).toBe("::1");
    });
  });
});
