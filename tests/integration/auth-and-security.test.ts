import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  auditLogs,
  db,
  elections,
  voterSessions,
  voters,
} from "@/db";
import { auth } from "@/lib/auth/admin-auth";
import {
  checkVoterLoginRateLimit,
  resetVoterLoginRateLimits,
} from "@/lib/auth/rate-limit";
import {
  VOTER_SESSION_COOKIE,
  getVoterSession,
  verifySignedSessionValue,
} from "@/lib/auth/voter-session";
import {
  getVoterSessionSecret,
  verifyVoterSessionCookieEdge,
} from "@/lib/auth/voter-session-edge";
import { castVoteSchema, voterLoginSchema } from "@/lib/validations/voter";
import { VotingError, castVoteTransaction } from "@/lib/voting/cast-vote";
import { middleware } from "@/middleware";
import { GET as adminCandidatesGet, POST as adminCandidatesPost } from "@/app/api/admin/candidates/route";
import { GET as adminResultsGet } from "@/app/api/admin/results/route";
import { POST as adminVoterResetTokenPost } from "@/app/api/admin/voters/[id]/reset-token/route";
import { GET as adminVotersGet } from "@/app/api/admin/voters/route";
import { GET as publicCandidatesGet } from "@/app/api/candidates/route";
import { POST as voterLoginPost } from "@/app/api/voter/login/route";
import { POST as voterLogoutPost } from "@/app/api/voter/logout/route";
import { POST as voterVotePost } from "@/app/api/voter/vote/route";
import {
  type BaselineIds,
  captureBaselineIds,
  cleanupTestArtifacts,
  createAdminNextRequest,
  createIsolatedElectionFixture,
  createIsolatedVoter,
  createPersistedVoterSession,
  createVoterNextRequest,
  signInSeedAdmin,
} from "../helpers/neon-test-harness";

let currentMockHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentMockHeaders,
}));

describe("Auth, Keamanan Sesi, Lockout, Middleware & Visibilitas Hasil (TC-03, TC-05, TC-06, TC-08, TC-09)", () => {
  const createdElectionIds: string[] = [];
  let baseline: BaselineIds;

  async function withActiveElection<T>(
    electionId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await db
      .update(elections)
      .set({ isActive: true })
      .where(eq(elections.id, electionId));
    try {
      return await fn();
    } finally {
      await db
        .update(elections)
        .set({ isActive: false })
        .where(eq(elections.id, electionId));
    }
  }

  beforeAll(async () => {
    baseline = await captureBaselineIds();
  });

  beforeEach(() => {
    resetVoterLoginRateLimits();
    currentMockHeaders = new Headers();
  });

  afterAll(async () => {
    currentMockHeaders = new Headers();
    await cleanupTestArtifacts({
      baseline,
      electionIds: createdElectionIds,
    });
  });

  it("TC-03: menolak login dan vote di luar jadwal server (status !== 'open', startAt masa depan, endAt lampau) serta kandidat nonaktif", async () => {
    // 1. Status !== 'open' (closed)
    const closedSetup = await createIsolatedElectionFixture({
      status: "closed",
      isActive: false,
    });
    createdElectionIds.push(closedSetup.election.id);

    const { voter: closedVoter, plainToken: closedVoterToken } =
      await createIsolatedVoter({
        electionId: closedSetup.election.id,
        groupId: closedSetup.group.id,
        voterIdentity: "9001003",
      });

    await expect(
      castVoteTransaction({
        electionId: closedSetup.election.id,
        voterId: closedVoter.id,
        candidateId: closedSetup.candidateActive.id,
        ipAddress: "::1",
      })
    ).rejects.toMatchObject({
      code: "ELECTION_CLOSED",
      status: 403,
    });

    const { cookieValue: closedVoterCookie } = await createPersistedVoterSession({
      voterId: closedVoter.id,
      electionId: closedSetup.election.id,
    });
    const closedVoteRes = await voterVotePost(
      createVoterNextRequest(
        "http://localhost:3000/api/voter/vote",
        closedVoterCookie,
        {
          method: "POST",
          ip: "10.10.0.10",
          body: { candidateId: closedSetup.candidateActive.id },
        }
      )
    );
    expect(closedVoteRes.status).toBe(403);
    expect(
      ((await closedVoteRes.json()) as { error: { code: string } }).error.code
    ).toBe("ELECTION_CLOSED");

    // Pemilihan dengan isActive=false juga wajib menolak login (403 ELECTION_CLOSED)
    const inactiveElectionLoginRes = await voterLoginPost(
      createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
        method: "POST",
        ip: "10.10.0.0",
        body: {
          electionId: closedSetup.election.id,
          voterIdentity: closedVoter.voterIdentity,
          token: closedVoterToken,
        },
      })
    );
    expect(inactiveElectionLoginRes.status).toBe(403);
    expect(
      (
        (await inactiveElectionLoginRes.json()) as {
          error: { code: string };
        }
      ).error.code
    ).toBe("ELECTION_CLOSED");

    await withActiveElection(closedSetup.election.id, async () => {
      const loginClosedRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.10.0.1",
          body: {
            electionId: closedSetup.election.id,
            voterIdentity: closedVoter.voterIdentity,
            token: closedVoterToken,
          },
        })
      );
      expect(loginClosedRes.status).toBe(403);
      expect(
        ((await loginClosedRes.json()) as { error: { code: string } }).error.code
      ).toBe("ELECTION_CLOSED");
    });

    // 2. Jadwal startAt di masa depan
    const futureSetup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
      startOffsetMs: 3_600_000,
      endOffsetMs: 7_200_000,
    });
    createdElectionIds.push(futureSetup.election.id);

    const { voter: futureVoter, plainToken: futureToken } =
      await createIsolatedVoter({
        electionId: futureSetup.election.id,
        groupId: futureSetup.group.id,
        voterIdentity: "9001004",
      });

    await expect(
      castVoteTransaction({
        electionId: futureSetup.election.id,
        voterId: futureVoter.id,
        candidateId: futureSetup.candidateActive.id,
        ipAddress: "::1",
      })
    ).rejects.toMatchObject({
      code: "ELECTION_CLOSED",
      status: 403,
    });

    await withActiveElection(futureSetup.election.id, async () => {
      const loginFutureRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.10.0.2",
          body: {
            electionId: futureSetup.election.id,
            voterIdentity: futureVoter.voterIdentity,
            token: futureToken,
          },
        })
      );
      expect(loginFutureRes.status).toBe(403);
      expect(
        ((await loginFutureRes.json()) as { error: { code: string } }).error.code
      ).toBe("ELECTION_CLOSED");
    });

    // 3. Jadwal endAt sudah lewat (1 menit yang lalu)
    const pastSetup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
      startOffsetMs: -7_200_000,
      endOffsetMs: -60_000,
    });
    createdElectionIds.push(pastSetup.election.id);

    const { voter: pastVoter, plainToken: pastToken } =
      await createIsolatedVoter({
        electionId: pastSetup.election.id,
        groupId: pastSetup.group.id,
        voterIdentity: "9001014",
      });

    const { cookieValue: pastVoterCookie } = await createPersistedVoterSession({
      voterId: pastVoter.id,
      electionId: pastSetup.election.id,
    });
    const pastVoteRes = await voterVotePost(
      createVoterNextRequest(
        "http://localhost:3000/api/voter/vote",
        pastVoterCookie,
        {
          method: "POST",
          ip: "10.10.0.11",
          body: { candidateId: pastSetup.candidateActive.id },
        }
      )
    );
    expect(pastVoteRes.status).toBe(403);
    expect(
      ((await pastVoteRes.json()) as { error: { code: string } }).error.code
    ).toBe("ELECTION_CLOSED");

    await withActiveElection(pastSetup.election.id, async () => {
      const loginPastRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.10.0.3",
          body: {
            electionId: pastSetup.election.id,
            voterIdentity: pastVoter.voterIdentity,
            token: pastToken,
          },
        })
      );
      expect(loginPastRes.status).toBe(403);
      expect(
        ((await loginPastRes.json()) as { error: { code: string } }).error.code
      ).toBe("ELECTION_CLOSED");
    });

    // 4. Kandidat nonaktif ditolak dengan INVALID_CANDIDATE (status 400 dari castVoteTransaction / API vote)
    const openSetup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
    });
    createdElectionIds.push(openSetup.election.id);

    const { voter: openVoter } = await createIsolatedVoter({
      electionId: openSetup.election.id,
      groupId: openSetup.group.id,
      voterIdentity: "9001005",
    });

    await expect(
      castVoteTransaction({
        electionId: openSetup.election.id,
        voterId: openVoter.id,
        candidateId: openSetup.candidateInactive!.id,
        ipAddress: "::1",
      })
    ).rejects.toThrow(VotingError);

    const { cookieValue: openVoterCookie } = await createPersistedVoterSession({
      voterId: openVoter.id,
      electionId: openSetup.election.id,
    });
    const inactiveCandRes = await voterVotePost(
      createVoterNextRequest(
        "http://localhost:3000/api/voter/vote",
        openVoterCookie,
        {
          method: "POST",
          ip: "10.10.0.12",
          body: { candidateId: openSetup.candidateInactive!.id },
        }
      )
    );
    expect(inactiveCandRes.status).toBe(400);
    expect(
      ((await inactiveCandRes.json()) as { error: { code: string } }).error.code
    ).toBe("INVALID_CANDIDATE");

    // Pastikan seluruh pemilih yang ditolak tetap hasVoted = false
    for (const vId of [closedVoter.id, futureVoter.id, pastVoter.id, openVoter.id]) {
      const [row] = await db
        .select({ hasVoted: voters.hasVoted })
        .from(voters)
        .where(eq(voters.id, vId));
      expect(row.hasVoted).toBe(false);
    }
  });

  it("TC-05: token salah mengembalikan 401 INVALID_CREDENTIALS tanpa membocorkan token di audit_logs, dan alur Reset Token membatalkan token lama serta mengaktifkan token baru", async () => {
    const setup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
    });
    createdElectionIds.push(setup.election.id);

    const oldToken = "AAAA2222";
    const { voter } = await createIsolatedVoter({
      electionId: setup.election.id,
      groupId: setup.group.id,
      voterIdentity: "2324011",
      name: "Pemilih Reset Token",
      plainToken: oldToken,
    });

    const committee = await signInSeedAdmin("committee");

    await withActiveElection(setup.election.id, async () => {
      // 1. Token salah -> 401 INVALID_CREDENTIALS, failedLoginAttempts = 1, audit_logs aman
      const wrongToken = "ZZZZ9999";
      const wrongRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.21.0.1",
          body: {
            electionId: setup.election.id,
            voterIdentity: voter.voterIdentity,
            token: wrongToken,
          },
        })
      );
      expect(wrongRes.status).toBe(401);
      expect(
        ((await wrongRes.json()) as { error: { code: string } }).error.code
      ).toBe("INVALID_CREDENTIALS");

      const [afterWrong] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, voter.id));
      expect(afterWrong.failedLoginAttempts).toBe(1);

      // 2. Panitia memanggil POST /api/admin/voters/[id]/reset-token
      currentMockHeaders = new Headers({ cookie: committee.cookie });
      const resetReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${voter.id}/reset-token`,
        committee.cookie,
        { method: "POST", ip: "10.21.0.2" }
      );
      const resetRes = await adminVoterResetTokenPost(resetReq, {
        params: Promise.resolve({ id: voter.id }),
      });
      expect(resetRes.status).toBe(200);
      const resetJson = (await resetRes.json()) as {
        success: boolean;
        data: { voterId: string; voterIdentity: string; newToken: string };
      };
      expect(resetJson.success).toBe(true);
      expect(resetJson.data.voterId).toBe(voter.id);
      expect(resetJson.data.newToken).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
      expect(resetJson.data.newToken).not.toBe(oldToken);

      const newToken = resetJson.data.newToken;

      // Reset token harus mengosongkan failedLoginAttempts dan lockedUntil
      const [afterReset] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, voter.id));
      expect(afterReset.failedLoginAttempts).toBe(0);
      expect(afterReset.lockedUntil).toBeNull();

      // 3. Login dengan token LAMA (AAAA2222) wajib gagal 401 INVALID_CREDENTIALS
      const oldTokenRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.21.0.3",
          body: {
            electionId: setup.election.id,
            voterIdentity: voter.voterIdentity,
            token: oldToken,
          },
        })
      );
      expect(oldTokenRes.status).toBe(401);
      expect(
        ((await oldTokenRes.json()) as { error: { code: string } }).error.code
      ).toBe("INVALID_CREDENTIALS");

      const [afterOldAttempt] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, voter.id));
      expect(afterOldAttempt.failedLoginAttempts).toBe(1);

      // Verifikasi audit log voter_login_failed tercatat dan tidak membocorkan token
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.electionId, setup.election.id));
      const failedLogs = logs.filter((l) => l.action === "voter_login_failed");
      expect(failedLogs.length).toBe(2);
      for (const log of failedLogs) {
        expect(log.description).not.toContain(wrongToken);
        expect(log.description).not.toContain(oldToken);
        expect(log.description).not.toContain(newToken);
      }
      expect(logs.some((l) => l.action === "voter_token_reset")).toBe(true);

      // 4. Login dengan token BARU berhasil 200
      const newTokenRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.21.0.4",
          body: {
            electionId: setup.election.id,
            voterIdentity: voter.voterIdentity,
            token: newToken,
          },
        })
      );
      expect(newTokenRes.status).toBe(200);
      const newTokenJson = (await newTokenRes.json()) as {
        success: boolean;
        data: { redirectTo: string };
      };
      expect(newTokenJson.success).toBe(true);
      expect(newTokenJson.data.redirectTo).toBe("/vote");
    });
  });

  it("TC-06: 5x salah token berurutan maupun paralel mengunci akun selama 15 menit (lockedUntil) dan menolak percobaan ke-6 meski token benar (403 VOTER_LOCKED)", async () => {
    const setup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
    });
    createdElectionIds.push(setup.election.id);

    const { voter, plainToken } = await createIsolatedVoter({
      electionId: setup.election.id,
      groupId: setup.group.id,
      voterIdentity: "9001006",
      name: "Dian Purnama",
      plainToken: "ABCD2345",
    });

    await withActiveElection(setup.election.id, async () => {
      // 1. 5x berurutan salah token
      for (let attempt = 1; attempt <= 5; attempt++) {
        const res = await voterLoginPost(
          createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
            method: "POST",
            ip: `10.20.0.${attempt}`,
            body: {
              electionId: setup.election.id,
              voterIdentity: voter.voterIdentity,
              token: "ZZZZ9999",
            },
          })
        );
        expect(res.status).toBe(401);
        expect(
          ((await res.json()) as { error: { code: string } }).error.code
        ).toBe("INVALID_CREDENTIALS");
      }

      const [lockedVoter] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, voter.id));
      expect(lockedVoter.failedLoginAttempts).toBe(5);
      expect(lockedVoter.lockedUntil).not.toBeNull();
      const lockDeltaMs = lockedVoter.lockedUntil!.getTime() - Date.now();
      expect(lockDeltaMs).toBeGreaterThan(14 * 60_000);
      expect(lockDeltaMs).toBeLessThanOrEqual(15 * 60_000 + 30_000);

      // Percobaan ke-6 dengan token BENAR tetap ditolak 403 VOTER_LOCKED
      const lockedRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.20.0.99",
          body: {
            electionId: setup.election.id,
            voterIdentity: voter.voterIdentity,
            token: plainToken,
          },
        })
      );
      expect(lockedRes.status).toBe(403);
      expect(
        ((await lockedRes.json()) as { error: { code: string } }).error.code
      ).toBe("VOTER_LOCKED");

      // Audit log mencatat voter_login_failed tanpa token
      const failLogs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.electionId, setup.election.id));
      expect(failLogs.length).toBeGreaterThanOrEqual(5);
      for (const log of failLogs) {
        expect(log.action).toBe("voter_login_failed");
        expect(log.description).not.toContain("ZZZZ9999");
        expect(log.description).not.toContain(plainToken);
      }

      // 2. 5x salah token secara paralel mengunci akun secara atomik
      const { voter: raceVoter, plainToken: raceToken } =
        await createIsolatedVoter({
          electionId: setup.election.id,
          groupId: setup.group.id,
          voterIdentity: "9001013",
        });

      const parallelWrongLogins = Array.from({ length: 5 }, (_, idx) =>
        voterLoginPost(
          createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
            method: "POST",
            ip: `10.70.0.${idx + 1}`,
            body: {
              electionId: setup.election.id,
              voterIdentity: raceVoter.voterIdentity,
              token: "ZZZZ9999",
            },
          })
        )
      );
      const wrongResults = await Promise.all(parallelWrongLogins);
      for (const r of wrongResults) {
        expect(r.status).toBe(401);
      }

      const [afterParallelLock] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, raceVoter.id));
      expect(afterParallelLock.failedLoginAttempts).toBe(5);
      expect(afterParallelLock.lockedUntil).not.toBeNull();
      expect(afterParallelLock.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      const lockedValidRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.70.0.99",
          body: {
            electionId: setup.election.id,
            voterIdentity: raceVoter.voterIdentity,
            token: raceToken,
          },
        })
      );
      expect(lockedValidRes.status).toBe(403);
      expect(
        ((await lockedValidRes.json()) as { error: { code: string } }).error.code
      ).toBe("VOTER_LOCKED");
    });
  });

  it("Rate limiter membatasi 10 req/menit per IP + NIS tanpa memblokir NIS lain di IP sama, dan Better Auth membatasi 5x salah login (429)", async () => {
    for (let i = 0; i < 10; i++) {
      expect(checkVoterLoginRateLimit("10.30.0.1", "9002001").allowed).toBe(
        true
      );
    }
    const eleventh = checkVoterLoginRateLimit("10.30.0.1", "9002001");
    expect(eleventh.allowed).toBe(false);
    expect(eleventh.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    // NIS berbeda pada jaringan Wi-Fi sekolah (IP sama) tetap diizinkan
    expect(checkVoterLoginRateLimit("10.30.0.1", "9002002").allowed).toBe(true);

    // HTTP rate limiter Better Auth pada /api/auth/sign-in/username memblokir percobaan ke-6 (429)
    const testIp = "198.51.100.240";
    for (let i = 1; i <= 5; i++) {
      const res = await auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/username", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": testIp,
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            username: "admin",
            password: "WrongPassword123!",
          }),
        })
      );
      expect(res.status).toBe(401);
    }
    const sixthRes = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": testIp,
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          username: "admin",
          password: "WrongPassword123!",
        }),
      })
    );
    expect(sixthRes.status).toBe(429);
  });

  it("Login pemilih valid membuat cookie bertanda tangan HMAC, mengaktifkan status logged_in, dan memvalidasi sesi", async () => {
    const setup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
    });
    createdElectionIds.push(setup.election.id);

    const { voter, plainToken } = await createIsolatedVoter({
      electionId: setup.election.id,
      groupId: setup.group.id,
      voterIdentity: "9001007",
      name: "Nadia Kusuma",
    });

    await withActiveElection(setup.election.id, async () => {
      const res = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.40.0.5",
          headers: {
            "user-agent": "Vitest-Integration/1.0",
          },
          body: {
            electionId: setup.election.id,
            voterIdentity: voter.voterIdentity,
            token: plainToken.toLowerCase(),
          },
        })
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { voter: { id: string; hasVoted: boolean }; redirectTo: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.redirectTo).toBe("/vote");

      const cookie = res.cookies.get(VOTER_SESSION_COOKIE);
      expect(cookie?.value).toBeTruthy();
      expect(verifySignedSessionValue(cookie!.value)).not.toBeNull();
      await expect(verifyVoterSessionCookieEdge(cookie!.value)).resolves.toBe(
        true
      );

      // Cookie yang dimodifikasi wajib ditolak
      const tamperedCookie = `${cookie!.value.slice(0, -2)}00`;
      expect(verifySignedSessionValue(tamperedCookie)).toBeNull();
      await expect(verifyVoterSessionCookieEdge(tamperedCookie)).resolves.toBe(
        false
      );

      const resolvedSession = await getVoterSession(cookie!.value);
      expect(resolvedSession).not.toBeNull();
      expect(resolvedSession?.id).toBe(voter.id);
      expect(resolvedSession?.voterStatus).toBe("logged_in");

      const [dbSession] = await db
        .select()
        .from(voterSessions)
        .where(eq(voterSessions.voterId, voter.id));
      expect(dbSession).toBeDefined();
    });
  });

  it("TC-08: Middleware dan Route Handler memblokir pemilih (tanpa sesi Better Auth) & anonim ke /admin/* dan /api/admin/* serta melindungi /vote/*", async () => {
    const setup = await createIsolatedElectionFixture({
      isActive: false,
    });
    createdElectionIds.push(setup.election.id);

    const { voter } = await createIsolatedVoter({
      electionId: setup.election.id,
      groupId: setup.group.id,
      voterIdentity: "9001008",
    });
    const { cookieValue } = await createPersistedVoterSession({
      voterId: voter.id,
      electionId: setup.election.id,
      ipAddress: "::1",
    });

    // 1. Pemilih bersesi & anonim mengakses /api/admin/* via middleware -> 401
    for (const cookieVal of [cookieValue, null]) {
      const votersApiRes = await middleware(
        createVoterNextRequest(
          "http://localhost:3000/api/admin/voters",
          cookieVal
        )
      );
      expect(votersApiRes.status).toBe(401);

      const candidatesApiRes = await middleware(
        createVoterNextRequest(
          "http://localhost:3000/api/admin/candidates",
          cookieVal,
          { method: "POST" }
        )
      );
      expect(candidatesApiRes.status).toBe(401);
    }

    // 2. Direct Route Handler call dengan cookie pemilih saja -> 401 UNAUTHORIZED
    currentMockHeaders = new Headers({
      cookie: `${VOTER_SESSION_COOKIE}=${cookieValue}`,
    });
    const directVotersRes = await adminVotersGet(
      createVoterNextRequest(
        "http://localhost:3000/api/admin/voters",
        cookieValue
      )
    );
    expect(directVotersRes.status).toBe(401);

    const directCandidatesPostRes = await adminCandidatesPost(
      createVoterNextRequest(
        "http://localhost:3000/api/admin/candidates",
        cookieValue,
        { method: "POST", body: { name: "Bypass" } }
      )
    );
    expect(directCandidatesPostRes.status).toBe(401);

    const directCandidatesGetRes = await adminCandidatesGet(
      createVoterNextRequest(
        "http://localhost:3000/api/admin/candidates",
        cookieValue
      )
    );
    expect(directCandidatesGetRes.status).toBe(401);

    // 3. Pemilih & anonim mengakses /admin/* -> redirect 307 ke /admin/login
    for (const cookieVal of [cookieValue, null]) {
      const adminPageRes = await middleware(
        createVoterNextRequest(
          "http://localhost:3000/admin/dashboard",
          cookieVal
        )
      );
      expect(adminPageRes.status).toBe(307);
      expect(new URL(adminPageRes.headers.get("location")!).pathname).toBe(
        "/admin/login"
      );
    }

    // 4. Anonim atau cookie rusak ke /vote -> redirect ke /login
    const anonVoteRes = await middleware(
      new NextRequest("http://localhost:3000/vote")
    );
    expect(anonVoteRes.status).toBe(307);
    expect(new URL(anonVoteRes.headers.get("location")!).pathname).toBe(
      "/login"
    );

    const corruptVoteRes = await middleware(
      createVoterNextRequest("http://localhost:3000/vote", "tampered.cookie")
    );
    expect(corruptVoteRes.status).toBe(307);
    expect(new URL(corruptVoteRes.headers.get("location")!).pathname).toBe(
      "/login"
    );

    // 5. Cookie valid ke /vote -> diteruskan (200)
    const validVoteRes = await middleware(
      createVoterNextRequest("http://localhost:3000/vote", cookieValue)
    );
    expect(validVoteRes.status).toBe(200);
  });

  it("TC-09: saat status='open' & isResultPublic=false, pemilih/anonim ditolak di GET /api/admin/results dan publik GET /api/candidates tidak membocorkan voteCount/percentage", async () => {
    const setup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
      isResultPublic: false,
      activeCandidateCount: 2,
      includeInactiveCandidate: true,
    });
    createdElectionIds.push(setup.election.id);

    const { voter } = await createIsolatedVoter({
      electionId: setup.election.id,
      groupId: setup.group.id,
      voterIdentity: "9001020",
      name: "Pemilih Hasil Tertutup",
    });

    // Catat 1 suara valid agar tabel votes benar-benar berisi data
    await castVoteTransaction({
      electionId: setup.election.id,
      voterId: voter.id,
      candidateId: setup.candidateActive.id,
      ipAddress: "10.80.0.1",
    });

    const { cookieValue } = await createPersistedVoterSession({
      voterId: voter.id,
      electionId: setup.election.id,
    });

    // 1. Anon & pemilih memanggil GET /api/admin/results -> 401/403 & tidak ada total suara
    for (const cookieVal of [null, cookieValue]) {
      const mwRes = await middleware(
        createVoterNextRequest(
          `http://localhost:3000/api/admin/results?electionId=${setup.election.id}`,
          cookieVal
        )
      );
      expect([401, 403]).toContain(mwRes.status);

      currentMockHeaders = cookieVal
        ? new Headers({ cookie: `${VOTER_SESSION_COOKIE}=${cookieVal}` })
        : new Headers();
      const routeRes = await adminResultsGet(
        createVoterNextRequest(
          `http://localhost:3000/api/admin/results?electionId=${setup.election.id}`,
          cookieVal
        )
      );
      expect([401, 403]).toContain(routeRes.status);
      const rawText = await routeRes.text();
      expect(rawText).not.toContain("voteCount");
      expect(rawText).not.toContain("votesCast");
      expect(rawText).not.toContain("turnoutPercentage");
    }

    // 2. Publik GET /api/candidates pada pemilihan aktif (restorasi isActive=false di finally)
    await withActiveElection(setup.election.id, async () => {
      const res = await publicCandidatesGet();
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: {
          election: {
            id: string;
            shortName: string;
            title: string;
            organizationName: string;
            status: string;
          };
          candidates: Array<Record<string, unknown>>;
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.election.id).toBe(setup.election.id);
      expect(json.data.election.status).toBe("open");
      expect(json.data.candidates).toHaveLength(2);
      expect(
        json.data.candidates.some((c) => c.id === setup.candidateInactive?.id)
      ).toBe(false);

      for (const candidate of json.data.candidates) {
        expect(candidate.isActive).toBe(true);
        expect(typeof candidate.name).toBe("string");
        expect(typeof candidate.vision).toBe("string");
        expect(Array.isArray(candidate.missions)).toBe(true);
        expect(Array.isArray(candidate.programs)).toBe(true);
        expect("voteCount" in candidate).toBe(false);
        expect("percentage" in candidate).toBe(false);
        expect(candidate).not.toHaveProperty("voteCount");
        expect(candidate).not.toHaveProperty("percentage");
      }

      expect(json.data).not.toHaveProperty("votesCast");
      expect(json.data).not.toHaveProperty("totalVoters");
      expect(json.data).not.toHaveProperty("summary");
    });
  });

  it("Better Auth memverifikasi akun seed @admin dan @panitia dan menolak password salah", async () => {
    const adminPassword =
      process.env.INITIAL_ADMIN_PASSWORD || "AdminPilketos2026!Secure";

    const adminSignIn = await auth.api.signInUsername({
      body: {
        username: process.env.INITIAL_ADMIN_USERNAME || "admin",
        password: adminPassword,
      },
    });
    expect(adminSignIn.user).toBeDefined();
    expect((adminSignIn.user as { role?: string }).role).toBe("super_admin");

    const committeeSignIn = await auth.api.signInUsername({
      body: {
        username: "panitia",
        password: "PanitiaPilketos2026!",
      },
    });
    expect(committeeSignIn.user).toBeDefined();
    expect((committeeSignIn.user as { role?: string }).role).toBe("committee");

    await expect(
      auth.api.signInUsername({
        body: {
          username: "admin",
          password: "WrongPassword123!",
        },
      })
    ).rejects.toThrow();
  });

  it("Pemilih yang sudah memilih mendapat redirectTo=/vote/thanks saat login meski jadwal ditutup, dan logout mengembalikan status not_voted jika belum memilih", async () => {
    const closedSetup = await createIsolatedElectionFixture({
      status: "closed",
      isActive: false,
    });
    createdElectionIds.push(closedSetup.election.id);

    const { voter: votedVoter, plainToken: votedToken } =
      await createIsolatedVoter({
        electionId: closedSetup.election.id,
        groupId: closedSetup.group.id,
        voterIdentity: "9001009",
        name: "Rudi Hartono",
        hasVoted: true,
      });

    await withActiveElection(closedSetup.election.id, async () => {
      const loginVotedRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.50.0.1",
          body: {
            electionId: closedSetup.election.id,
            voterIdentity: votedVoter.voterIdentity,
            token: votedToken,
          },
        })
      );
      expect(loginVotedRes.status).toBe(200);
      const loginVotedJson = (await loginVotedRes.json()) as {
        data: { redirectTo: string; voter: { hasVoted: boolean } };
      };
      expect(loginVotedJson.data.voter.hasVoted).toBe(true);
      expect(loginVotedJson.data.redirectTo).toBe("/vote/thanks");
    });

    // Uji logout middleware -> /api/voter/logout
    const unauthLogoutReq = new NextRequest(
      "http://localhost:3000/api/voter/logout",
      { method: "POST" }
    );
    const unauthLogoutRes = await middleware(unauthLogoutReq);
    expect(unauthLogoutRes.status).toBe(401);

    // Uji voterLogoutPost langsung tidak error walau tanpa next/headers context
    const logoutDirectRes = await voterLogoutPost(unauthLogoutReq);
    expect(logoutDirectRes.status).toBe(200);

    // Uji logout pemilih unvoted: menghapus sesi dan mengembalikan voterStatus -> not_voted
    const openSetup = await createIsolatedElectionFixture({
      status: "open",
      isActive: false,
    });
    createdElectionIds.push(openSetup.election.id);

    const { voter: unvotedVoter, plainToken: unvotedToken } =
      await createIsolatedVoter({
        electionId: openSetup.election.id,
        groupId: openSetup.group.id,
        voterIdentity: "9001010",
        name: "Tono Prasetyo",
      });

    await withActiveElection(openSetup.election.id, async () => {
      const loginUnvotedRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.50.0.2",
          body: {
            electionId: openSetup.election.id,
            voterIdentity: unvotedVoter.voterIdentity,
            token: unvotedToken,
          },
        })
      );
      expect(loginUnvotedRes.status).toBe(200);
      const sessionCookie = loginUnvotedRes.cookies.get(VOTER_SESSION_COOKIE)!;

      const [loggedInRow] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, unvotedVoter.id));
      expect(loggedInRow.voterStatus).toBe("logged_in");

      const logoutRes = await voterLogoutPost(
        createVoterNextRequest(
          "http://localhost:3000/api/voter/logout",
          sessionCookie.value,
          { method: "POST", ip: "10.50.0.2" }
        )
      );
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.cookies.get(VOTER_SESSION_COOKIE)?.value).toBe("");

      const [loggedOutRow] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, unvotedVoter.id));
      expect(loggedOutRow.voterStatus).toBe("not_voted");
      expect(await getVoterSession(sessionCookie.value)).toBeNull();
    });
  });

  it("Validasi input, error path, anti-enumerasi closed election, dan secret production enforcement bekerja sesuai spesifikasi", async () => {
    // 1. Zod validation edge cases (karakter ambigu 0, O, 1, I, L ditolak)
    expect(
      voterLoginSchema.safeParse({
        voterIdentity: "2324001",
        token: "0O1ILABC",
      }).success
    ).toBe(false);
    expect(
      voterLoginSchema.safeParse({
        voterIdentity: "  ",
        token: "JUFT88TF",
      }).success
    ).toBe(false);
    expect(
      castVoteSchema.safeParse({ candidateId: "not-a-uuid" }).success
    ).toBe(false);

    // 2. Malformed JSON / validation error pada /api/voter/login -> 400
    const invalidLoginRes = await voterLoginPost(
      new NextRequest("http://localhost:3000/api/voter/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      })
    );
    expect(invalidLoginRes.status).toBe(400);
    expect(
      ((await invalidLoginRes.json()) as { error: { code: string } }).error.code
    ).toBe("VALIDATION_ERROR");

    // 3. /api/voter/vote tanpa sesi -> 401 UNAUTHORIZED
    const unauthVoteRes = await voterVotePost(
      new NextRequest("http://localhost:3000/api/voter/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId: "c1000000-0000-0000-0000-000000000001",
        }),
      })
    );
    expect(unauthVoteRes.status).toBe(401);

    // 4. VOTER_SESSION_SECRET wajib ada di production
    const prevEnv = { ...process.env };
    try {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
      delete process.env.VOTER_SESSION_SECRET;
      expect(() => getVoterSessionSecret()).toThrow(/VOTER_SESSION_SECRET/);
    } finally {
      process.env = prevEnv;
    }

    // 5. Token salah saat pemilihan closed tidak membocorkan status hasVoted atau keberadaan NIS
    const closedSetup = await createIsolatedElectionFixture({
      status: "closed",
      isActive: false,
    });
    createdElectionIds.push(closedSetup.election.id);

    const { voter: unvotedVoter, plainToken: unvotedToken } =
      await createIsolatedVoter({
        electionId: closedSetup.election.id,
        groupId: closedSetup.group.id,
        voterIdentity: "9001011",
      });
    const { voter: votedVoter } = await createIsolatedVoter({
      electionId: closedSetup.election.id,
      groupId: closedSetup.group.id,
      voterIdentity: "9001012",
      hasVoted: true,
    });

    await withActiveElection(closedSetup.election.id, async () => {
      for (const identity of [
        unvotedVoter.voterIdentity,
        votedVoter.voterIdentity,
        "9999999",
      ]) {
        const probeRes = await voterLoginPost(
          createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
            method: "POST",
            ip: `10.60.0.${identity.slice(-2)}`,
            body: {
              electionId: closedSetup.election.id,
              voterIdentity: identity,
              token: "ZZZZ9999",
            },
          })
        );
        expect(probeRes.status).toBe(401);
        expect(
          ((await probeRes.json()) as { error: { code: string } }).error.code
        ).toBe("INVALID_CREDENTIALS");
      }

      // Token benar saat pemilihan closed untuk unvotedVoter tetap ditolak 403 ELECTION_CLOSED
      const closedValidRes = await voterLoginPost(
        createVoterNextRequest("http://localhost:3000/api/voter/login", null, {
          method: "POST",
          ip: "10.60.1.1",
          body: {
            electionId: closedSetup.election.id,
            voterIdentity: unvotedVoter.voterIdentity,
            token: unvotedToken,
          },
        })
      );
      expect(closedValidRes.status).toBe(403);
      expect(
        ((await closedValidRes.json()) as { error: { code: string } }).error.code
      ).toBe("ELECTION_CLOSED");
    });
  });
});
