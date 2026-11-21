import crypto from "node:crypto";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  accounts,
  auditLogs,
  candidates,
  db,
  gradeLevels,
  majors,
  voterGroups,
  voters,
  votes,
} from "@/db";
import {
  captureBaselineIds,
  cleanupTestArtifacts,
  createAdminNextRequest,
  createIsolatedElectionFixture,
  createIsolatedVoter,
  signInSeedAdmin,
  type BaselineIds,
} from "../helpers/neon-test-harness";

// Mock next/headers so getAdminSession() in admin-guard reads the active test role cookie
let currentMockHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentMockHeaders,
}));

// Import route handlers after mocking next/headers
import { GET as dashboardGet } from "@/app/api/admin/dashboard/route";
import { GET as resultsGet } from "@/app/api/admin/results/route";
import {
  GET as candidatesGet,
  POST as candidatesPost,
} from "@/app/api/admin/candidates/route";
import {
  DELETE as candidateIdDelete,
  PATCH as candidateIdPatch,
} from "@/app/api/admin/candidates/[id]/route";
import { POST as uploadPost } from "@/app/api/admin/upload/route";
import {
  DELETE as votersDelete,
  GET as votersGet,
  POST as votersPost,
} from "@/app/api/admin/voters/route";
import { POST as votersImportPost } from "@/app/api/admin/voters/import/route";
import {
  DELETE as voterIdDelete,
  PATCH as voterIdPatch,
} from "@/app/api/admin/voters/[id]/route";
import { POST as voterResetTokenPost } from "@/app/api/admin/voters/[id]/reset-token/route";
import {
  GET as voterCopyTokenGet,
  POST as voterCopyTokenPost,
} from "@/app/api/admin/voters/[id]/copy-token/route";
import {
  DELETE as masterDelete,
  GET as masterGet,
  PATCH as masterPatch,
  POST as masterPost,
} from "@/app/api/admin/master/route";
import {
  GET as settingsGet,
  PUT as settingsPut,
} from "@/app/api/admin/settings/route";
import { GET as logsGet } from "@/app/api/admin/logs/route";
import {
  GET as usersGet,
  POST as usersPost,
} from "@/app/api/admin/users/route";
import {
  DELETE as userIdDelete,
  PATCH as userIdPatch,
} from "@/app/api/admin/users/[id]/route";

describe("Admin RBAC, Voter Immutability & Bulk DPT Import Integration (TC-07, TC-10, TC-12)", () => {
  let baseline: BaselineIds;
  let adminCookie = "";
  let committeeCookie = "";
  let superAdminUserId = "";
  let testElectionId = "";
  let testGroupId = "";
  const createdElectionIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    baseline = await captureBaselineIds();

    const adminAuth = await signInSeedAdmin("super_admin");
    adminCookie = adminAuth.cookie;
    superAdminUserId = adminAuth.userId ?? "";

    const committeeAuth = await signInSeedAdmin("committee");
    committeeCookie = committeeAuth.cookie;

    const fixture = await createIsolatedElectionFixture({
      isActive: false,
      isResultPublic: true,
      activeCandidateCount: 1,
      includeInactiveCandidate: false,
    });
    testElectionId = fixture.election.id;
    testGroupId = fixture.group.id;
    createdElectionIds.push(testElectionId);
  });

  afterAll(async () => {
    await cleanupTestArtifacts({
      baseline,
      electionIds: createdElectionIds,
      userIds: createdUserIds,
    });
  });

  function setAuthRole(role: "super_admin" | "committee" | "anonymous") {
    if (role === "super_admin") {
      currentMockHeaders = new Headers({ cookie: adminCookie });
    } else if (role === "committee") {
      currentMockHeaders = new Headers({ cookie: committeeCookie });
    } else {
      currentMockHeaders = new Headers();
    }
  }

  function activeCookie(role: "super_admin" | "committee" | "anonymous"): string | null {
    if (role === "super_admin") return adminCookie;
    if (role === "committee") return committeeCookie;
    return null;
  }

  // =========================================================================
  // 1. RBAC Matrix & Role Enforcement (TC-10)
  // =========================================================================
  describe("1. RBAC Matrix & Role Enforcement (TC-10)", () => {
    it("Menolak akses anonim (401 UNAUTHORIZED) pada endpoint admin", async () => {
      setAuthRole("anonymous");

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/dashboard",
        activeCookie("anonymous")
      );
      const res = await dashboardGet(req);
      expect(res.status).toBe(401);

      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("TC-10: Menolak peran 'committee' (403 FORBIDDEN) pada seluruh endpoint khusus super_admin", async () => {
      setAuthRole("committee");

      // 1. POST /api/admin/candidates
      const candReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/candidates",
        committeeCookie,
        {
          method: "POST",
          body: {
            electionId: testElectionId,
            candidateNumber: 10,
            name: "Calon 10",
            classOrUnit: "XII-1",
            motto: "Motto calon 10",
            vision: "Visi calon nomor urut sepuluh",
            missions: ["Misi calon 10"],
          },
        }
      );
      const candRes = await candidatesPost(candReq);
      expect(candRes.status).toBe(403);
      expect(((await candRes.json()) as { error: { code: string } }).error.code).toBe(
        "FORBIDDEN"
      );

      // 2. PATCH /api/admin/candidates/[id]
      const randomCandId = crypto.randomUUID();
      const candPatchReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/candidates/${randomCandId}`,
        committeeCookie,
        {
          method: "PATCH",
          body: { name: "Nama Baru" },
        }
      );
      const candPatchRes = await candidateIdPatch(candPatchReq, {
        params: Promise.resolve({ id: randomCandId }),
      });
      expect(candPatchRes.status).toBe(403);
      expect(
        ((await candPatchRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 3. DELETE /api/admin/candidates/[id]
      const candDelReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/candidates/${randomCandId}`,
        committeeCookie,
        { method: "DELETE" }
      );
      const candDelRes = await candidateIdDelete(candDelReq, {
        params: Promise.resolve({ id: randomCandId }),
      });
      expect(candDelRes.status).toBe(403);
      expect(
        ((await candDelRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 4. POST /api/admin/upload
      const uploadReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/upload",
        committeeCookie,
        { method: "POST" }
      );
      const uploadRes = await uploadPost(uploadReq);
      expect(uploadRes.status).toBe(403);
      expect(
        ((await uploadRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 5. POST /api/admin/master
      const masterPostReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/master",
        committeeCookie,
        {
          method: "POST",
          body: {
            entity: "grade",
            electionId: testElectionId,
            name: "Kelas Baru",
          },
        }
      );
      const masterPostRes = await masterPost(masterPostReq);
      expect(masterPostRes.status).toBe(403);
      expect(
        ((await masterPostRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 6. PUT /api/admin/settings
      const settingsPutReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/settings",
        committeeCookie,
        {
          method: "PUT",
          body: {
            electionId: testElectionId,
            title: "Judul Baru",
          },
        }
      );
      const settingsPutRes = await settingsPut(settingsPutReq);
      expect(settingsPutRes.status).toBe(403);
      expect(
        ((await settingsPutRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 7. GET /api/admin/users
      const usersGetRes = await usersGet();
      expect(usersGetRes.status).toBe(403);
      expect(
        ((await usersGetRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 8. POST /api/admin/users
      const usersPostReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/users",
        committeeCookie,
        {
          method: "POST",
          body: {
            username: "userbaru",
            name: "User Baru",
            email: "userbaru@test.com",
            password: "Password123!",
            role: "committee",
          },
        }
      );
      const usersPostRes = await usersPost(usersPostReq);
      expect(usersPostRes.status).toBe(403);
      expect(
        ((await usersPostRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 9. PATCH /api/admin/master
      const masterPatchReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/master",
        committeeCookie,
        {
          method: "PATCH",
          body: {
            entity: "grade",
            id: crypto.randomUUID(),
            name: "Kelas Edit",
          },
        }
      );
      const masterPatchRes = await masterPatch(masterPatchReq);
      expect(masterPatchRes.status).toBe(403);
      expect(
        ((await masterPatchRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 10. DELETE /api/admin/master
      const masterDeleteReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/master?entity=grade&id=${crypto.randomUUID()}`,
        committeeCookie,
        { method: "DELETE" }
      );
      const masterDeleteRes = await masterDelete(masterDeleteReq);
      expect(masterDeleteRes.status).toBe(403);
      expect(
        ((await masterDeleteRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 11. PATCH /api/admin/users/[id]
      const randomUserId = crypto.randomUUID();
      const userPatchReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${randomUserId}`,
        committeeCookie,
        {
          method: "PATCH",
          body: { name: "Ubah Nama" },
        }
      );
      const userPatchRes = await userIdPatch(userPatchReq, {
        params: Promise.resolve({ id: randomUserId }),
      });
      expect(userPatchRes.status).toBe(403);
      expect(
        ((await userPatchRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");

      // 12. DELETE /api/admin/users/[id]
      const userDelReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${randomUserId}`,
        committeeCookie,
        { method: "DELETE" }
      );
      const userDelRes = await userIdDelete(userDelReq, {
        params: Promise.resolve({ id: randomUserId }),
      });
      expect(userDelRes.status).toBe(403);
      expect(
        ((await userDelRes.json()) as { error: { code: string } }).error.code
      ).toBe("FORBIDDEN");
    });

    it("TC-10: Mengizinkan peran 'committee' (200/201) pada endpoint operasional pemilihan", async () => {
      setAuthRole("committee");

      // GET dashboard
      const dashRes = await dashboardGet(
        createAdminNextRequest(
          `http://localhost:3000/api/admin/dashboard?electionId=${testElectionId}`,
          committeeCookie
        )
      );
      expect(dashRes.status).toBe(200);

      // GET results
      const resRes = await resultsGet(
        createAdminNextRequest(
          `http://localhost:3000/api/admin/results?electionId=${testElectionId}`,
          committeeCookie
        )
      );
      expect(resRes.status).toBe(200);

      // GET candidates
      const candRes = await candidatesGet(
        createAdminNextRequest(
          `http://localhost:3000/api/admin/candidates?electionId=${testElectionId}`,
          committeeCookie
        )
      );
      expect(candRes.status).toBe(200);

      // GET master data
      const masterRes = await masterGet(
        createAdminNextRequest(
          `http://localhost:3000/api/admin/master?electionId=${testElectionId}`,
          committeeCookie
        )
      );
      expect(masterRes.status).toBe(200);

      // GET settings
      const setRes = await settingsGet(
        createAdminNextRequest(
          `http://localhost:3000/api/admin/settings?electionId=${testElectionId}`,
          committeeCookie
        )
      );
      expect(setRes.status).toBe(200);

      // GET logs
      const logRes = await logsGet(
        createAdminNextRequest(
          `http://localhost:3000/api/admin/logs?electionId=${testElectionId}`,
          committeeCookie
        )
      );
      expect(logRes.status).toBe(200);

      // POST /api/admin/voters
      const createVoterReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/voters",
        committeeCookie,
        {
          method: "POST",
          body: {
            electionId: testElectionId,
            groupId: testGroupId,
            voterIdentity: `NIS-CMT-${crypto.randomBytes(3).toString("hex")}`,
            name: "Pemilih Dari Panitia",
          },
        }
      );
      const createVoterRes = await votersPost(createVoterReq);
      expect(createVoterRes.status).toBe(201);
      const createdJson = (await createVoterRes.json()) as {
        success: boolean;
        data: { id: string; token: string | null };
      };
      expect(createdJson.success).toBe(true);
      expect(createdJson.data.token).toHaveLength(8);
    });
  });

  // =========================================================================
  // 2. Candidate Photo Upload Validation & Security (/api/admin/upload)
  // =========================================================================
  describe("2. Candidate Photo Upload Validation & Security (/api/admin/upload)", () => {
    it("Menolak file > 2MB dengan 400 VALIDATION_ERROR", async () => {
      setAuthRole("super_admin");

      const bigBuffer = Buffer.alloc(2.1 * 1024 * 1024);
      bigBuffer[0] = 0x89;
      bigBuffer[1] = 0x50;
      bigBuffer[2] = 0x4e;
      bigBuffer[3] = 0x47;

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([bigBuffer], { type: "image/png" }),
        "big-photo.png"
      );
      formData.append("electionId", testElectionId);

      const req = new NextRequest("http://localhost:3000/api/admin/upload", {
        method: "POST",
        headers: { cookie: adminCookie },
        body: formData,
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("2 MB");
    });

    it("Menolak file non-gambar (magic bytes bukan JPG/PNG/WebP) dengan 400 VALIDATION_ERROR", async () => {
      setAuthRole("super_admin");

      const fakeBuffer = Buffer.from("MALICIOUS SCRIPT CONTENT <?php echo 1; ?>");

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([fakeBuffer], { type: "image/png" }),
        "exploit.png"
      );
      formData.append("electionId", testElectionId);

      const req = new NextRequest("http://localhost:3000/api/admin/upload", {
        method: "POST",
        headers: { cookie: adminCookie },
        body: formData,
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; message: string } };
      expect(json.error.code).toBe("VALIDATION_ERROR");
      expect(json.error.message).toContain("Hanya JPG, PNG, dan WebP");
    });

    it("Menerima file PNG dengan magic bytes valid (89 50 4E 47) dan menyimpannya", async () => {
      setAuthRole("super_admin");

      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
      ]);

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([pngBuffer], { type: "image/png" }),
        "kandidat.png"
      );
      formData.append("electionId", testElectionId);

      const req = new NextRequest("http://localhost:3000/api/admin/upload", {
        method: "POST",
        headers: { cookie: adminCookie },
        body: formData,
      });

      const res = await uploadPost(req);
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        data: { url: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.url).toMatch(/\.png$/);
    });
  });

  // =========================================================================
  // 3. Voter Security, Privacy & Immutability (/api/admin/voters/* - TC-07)
  // =========================================================================
  describe("3. Voter Security, Privacy & Immutability (/api/admin/voters/* - TC-07)", () => {
    let unvotedVoterId = "";
    let votedVoterId = "";
    const unvotedPlainToken = "ABCDEFGH";
    const votedPlainToken = "WXYZ2345";

    beforeAll(async () => {
      const unvoted = await createIsolatedVoter({
        electionId: testElectionId,
        groupId: testGroupId,
        voterIdentity: "NIS-UNVOTED-01",
        name: "Pemilih Belum Memilih",
        plainToken: unvotedPlainToken,
        hasVoted: false,
      });
      unvotedVoterId = unvoted.voter.id;

      const voted = await createIsolatedVoter({
        electionId: testElectionId,
        groupId: testGroupId,
        voterIdentity: "NIS-VOTED-02",
        name: "Pemilih Sudah Memilih",
        plainToken: votedPlainToken,
        hasVoted: true,
      });
      votedVoterId = voted.voter.id;
    });

    it("TC-07: GET /api/admin/voters menyembunyikan token (token: null) untuk pemilih yang hasVoted = true", async () => {
      setAuthRole("committee");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters?electionId=${testElectionId}`,
        committeeCookie
      );
      const res = await votersGet(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        data: {
          voters: Array<{
            id: string;
            hasVoted: boolean;
            token: string | null;
            tokenPlain?: unknown;
          }>;
        };
      };

      const unvoted = json.data.voters.find((v) => v.id === unvotedVoterId);
      const voted = json.data.voters.find((v) => v.id === votedVoterId);

      expect(unvoted).toBeDefined();
      expect(unvoted?.hasVoted).toBe(false);
      expect(unvoted?.token).toBe(unvotedPlainToken);

      expect(voted).toBeDefined();
      expect(voted?.hasVoted).toBe(true);
      expect(voted?.token).toBeNull();
      expect(voted?.tokenPlain).toBeUndefined();
    });

    it("TC-07: PATCH /api/admin/voters/[id] menolak pengubahan pemilih yang sudah memilih dengan 409 VOTER_IMMUTABLE dan mengizinkan edit pemilih belum memilih", async () => {
      setAuthRole("committee");

      const blockedReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${votedVoterId}`,
        committeeCookie,
        {
          method: "PATCH",
          body: { name: "Coba Ubah Pemilih Voted" },
        }
      );
      const blockedRes = await voterIdPatch(blockedReq, {
        params: Promise.resolve({ id: votedVoterId }),
      });
      expect(blockedRes.status).toBe(409);
      const blockedJson = (await blockedRes.json()) as {
        error: { code: string; message: string };
      };
      expect(blockedJson.error.code).toBe("VOTER_IMMUTABLE");

      const allowedReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${unvotedVoterId}`,
        committeeCookie,
        {
          method: "PATCH",
          body: { name: "Pemilih Belum Memilih Diedit" },
        }
      );
      const allowedRes = await voterIdPatch(allowedReq, {
        params: Promise.resolve({ id: unvotedVoterId }),
      });
      expect(allowedRes.status).toBe(200);
      const allowedJson = (await allowedRes.json()) as {
        success: boolean;
        data: { name: string };
      };
      expect(allowedJson.success).toBe(true);
      expect(allowedJson.data.name).toBe("Pemilih Belum Memilih Diedit");
    });

    it("TC-07: DELETE /api/admin/voters/[id] menolak penghapusan pemilih yang sudah memilih dengan 409 VOTER_IMMUTABLE", async () => {
      setAuthRole("committee");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${votedVoterId}`,
        committeeCookie,
        { method: "DELETE" }
      );
      const res = await voterIdDelete(req, {
        params: Promise.resolve({ id: votedVoterId }),
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(json.error.code).toBe("VOTER_IMMUTABLE");
      expect(json.error.message).toContain("sudah memberikan suara");
    });

    it("TC-07: POST /api/admin/voters/[id]/reset-token menolak reset token pemilih yang sudah memilih dengan 409 VOTER_IMMUTABLE", async () => {
      setAuthRole("committee");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${votedVoterId}/reset-token`,
        committeeCookie,
        { method: "POST" }
      );
      const res = await voterResetTokenPost(req, {
        params: Promise.resolve({ id: votedVoterId }),
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("VOTER_IMMUTABLE");
    });

    it("TC-07: GET & POST /api/admin/voters/[id]/copy-token menolak salin token pemilih yang sudah memilih dengan 409 VOTER_IMMUTABLE", async () => {
      setAuthRole("committee");

      const getReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${votedVoterId}/copy-token`,
        committeeCookie,
        { method: "GET" }
      );
      const getRes = await voterCopyTokenGet(getReq, {
        params: Promise.resolve({ id: votedVoterId }),
      });
      expect(getRes.status).toBe(409);
      const getJson = (await getRes.json()) as { error: { code: string } };
      expect(getJson.error.code).toBe("VOTER_IMMUTABLE");

      const postReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${votedVoterId}/copy-token`,
        committeeCookie,
        { method: "POST" }
      );
      const postRes = await voterCopyTokenPost(postReq, {
        params: Promise.resolve({ id: votedVoterId }),
      });
      expect(postRes.status).toBe(409);
      const postJson = (await postRes.json()) as { error: { code: string } };
      expect(postJson.error.code).toBe("VOTER_IMMUTABLE");
    });

    it("POST /api/admin/voters/[id]/reset-token: berhasil mereset token pemilih yang belum memilih dan mencatat audit log", async () => {
      setAuthRole("committee");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${unvotedVoterId}/reset-token`,
        committeeCookie,
        { method: "POST" }
      );
      const res = await voterResetTokenPost(req, {
        params: Promise.resolve({ id: unvotedVoterId }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { newToken: string; voterIdentity: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.newToken).toHaveLength(8);
      expect(json.data.newToken).not.toBe(unvotedPlainToken);

      const [log] = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.electionId, testElectionId),
            eq(auditLogs.action, "voter_token_reset")
          )
        )
        .orderBy(sql`${auditLogs.createdAt} desc`)
        .limit(1);

      expect(log).toBeDefined();
      expect(log.description).not.toContain(json.data.newToken);
    });

    it("GET & POST /api/admin/voters/[id]/copy-token: berhasil menyalin token pemilih belum memilih dan mencatat audit log", async () => {
      setAuthRole("committee");

      // Test GET copy-token
      const getReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${unvotedVoterId}/copy-token`,
        committeeCookie,
        { method: "GET" }
      );
      const getRes = await voterCopyTokenGet(getReq, {
        params: Promise.resolve({ id: unvotedVoterId }),
      });
      expect(getRes.status).toBe(200);
      const getJson = (await getRes.json()) as {
        success: boolean;
        data: { voterId: string; voterIdentity: string; token: string };
      };
      expect(getJson.success).toBe(true);
      expect(getJson.data.voterId).toBe(unvotedVoterId);
      expect(getJson.data.voterIdentity).toBe("NIS-UNVOTED-01");
      expect(getJson.data.token).toHaveLength(8);

      // Test POST copy-token
      const postReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/voters/${unvotedVoterId}/copy-token`,
        committeeCookie,
        { method: "POST" }
      );
      const postRes = await voterCopyTokenPost(postReq, {
        params: Promise.resolve({ id: unvotedVoterId }),
      });
      expect(postRes.status).toBe(200);
      const postJson = (await postRes.json()) as {
        success: boolean;
        data: { voterId: string; voterIdentity: string; token: string };
      };
      expect(postJson.success).toBe(true);
      expect(postJson.data.token).toBe(getJson.data.token);

      const [log] = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.electionId, testElectionId),
            eq(auditLogs.action, "voter_token_copied")
          )
        )
        .orderBy(sql`${auditLogs.createdAt} desc`)
        .limit(1);

      expect(log).toBeDefined();
      expect(log.description).not.toContain(postJson.data.token);
    });
  });

  // =========================================================================
  // 4. Admin Users & Self-Protection (/api/admin/users/*)
  // =========================================================================
  describe("4. Admin Users & Self-Protection (/api/admin/users/*)", () => {
    let createdUserId = "";

    it("Super Admin berhasil membuat akun admin baru dan menyimpan hash password scrypt", async () => {
      setAuthRole("super_admin");

      const uniqueSuffix = crypto.randomBytes(3).toString("hex");
      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/users",
        adminCookie,
        {
          method: "POST",
          body: {
            username: `panitia_${uniqueSuffix}`,
            name: `Panitia ${uniqueSuffix}`,
            email: `panitia_${uniqueSuffix}@smabojonggede.sch.id`,
            password: "PanitiaSecurePassword123!",
            role: "committee",
          },
        }
      );

      const res = await usersPost(req);
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        data: { id: string; username: string; role: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.role).toBe("committee");
      createdUserId = json.data.id;
      createdUserIds.push(createdUserId);

      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, createdUserId))
        .limit(1);

      expect(account).toBeDefined();
      expect(account.password).toBeDefined();
      expect(account.password).not.toBe("PanitiaSecurePassword123!");
    });

    it("Menolak self-demote role super_admin (400 BAD_REQUEST)", async () => {
      setAuthRole("super_admin");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${superAdminUserId}`,
        adminCookie,
        {
          method: "PATCH",
          body: { role: "committee" },
        }
      );
      const res = await userIdPatch(req, {
        params: Promise.resolve({ id: superAdminUserId }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { message: string } };
      expect(json.error.message).toContain("menurunkan role akun Anda sendiri");
    });

    it("Menolak self-ban super_admin (400 BAD_REQUEST)", async () => {
      setAuthRole("super_admin");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${superAdminUserId}`,
        adminCookie,
        {
          method: "PATCH",
          body: { banned: true },
        }
      );
      const res = await userIdPatch(req, {
        params: Promise.resolve({ id: superAdminUserId }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { message: string } };
      expect(json.error.message).toContain("memblokir akun Anda sendiri");
    });

    it("Menolak self-delete super_admin (400 BAD_REQUEST)", async () => {
      setAuthRole("super_admin");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${superAdminUserId}`,
        adminCookie,
        { method: "DELETE" }
      );
      const res = await userIdDelete(req, {
        params: Promise.resolve({ id: superAdminUserId }),
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { message: string } };
      expect(json.error.message).toContain("menghapus akun Anda sendiri");
    });

    it("Super Admin dapat menghapus akun admin lain", async () => {
      setAuthRole("super_admin");

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${createdUserId}`,
        adminCookie,
        { method: "DELETE" }
      );
      const res = await userIdDelete(req, {
        params: Promise.resolve({ id: createdUserId }),
      });

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // 5. Results & Vote Privacy Guarantee
  // =========================================================================
  describe("5. Results & Vote Privacy Guarantee", () => {
    it("GET /api/admin/results: zero raw votes rows exposed; returns aggregation, turnout and leading candidate", async () => {
      setAuthRole("committee");

      const [cand] = await db
        .insert(candidates)
        .values({
          electionId: testElectionId,
          candidateNumber: 99,
          name: "Kandidat Uji Privasi",
          classOrUnit: "XII",
          motto: "Motto Privasi",
          vision: "Visi Privasi",
          missions: ["Misi Privasi"],
          isActive: true,
        })
        .returning();

      await db.insert(votes).values({
        id: crypto.randomUUID(),
        electionId: testElectionId,
        candidateId: cand.id,
      });

      const req = createAdminNextRequest(
        `http://localhost:3000/api/admin/results?electionId=${testElectionId}`,
        committeeCookie
      );
      const res = await resultsGet(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        success: boolean;
        data: {
          candidates: Array<{ candidateNumber: number; voteCount: number; rank: number }>;
          leadingCandidate: { candidateNumber: number; name: string } | null;
          summary: { votesCast: number };
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.summary.votesCast).toBeGreaterThanOrEqual(1);
      expect(json.data.leadingCandidate).toBeDefined();

      const candidateResult = json.data.candidates.find(
        (c) => c.candidateNumber === 99
      );
      expect(candidateResult).toBeDefined();
      expect(candidateResult?.voteCount).toBeGreaterThanOrEqual(1);

      expect((json.data as Record<string, unknown>).votes).toBeUndefined();
    });
  });

  // =========================================================================
  // 6. Bulk DPT Import Integration & Transaction Persistence (TC-12)
  // =========================================================================
  describe("6. Bulk DPT Import Integration & Transaction Persistence (/api/admin/voters/import - TC-12)", () => {
    let importElectionId = "";

    beforeAll(async () => {
      const importFixture = await createIsolatedElectionFixture({
        isActive: false,
        activeCandidateCount: 1,
        includeInactiveCandidate: false,
      });
      importElectionId = importFixture.election.id;
      createdElectionIds.push(importElectionId);

      // Rename default group to "Rombel 1" and create "Rombel 2"
      await db
        .update(voterGroups)
        .set({ name: "Rombel 1" })
        .where(eq(voterGroups.id, importFixture.group.id));

      await db.insert(voterGroups).values({
        electionId: importElectionId,
        gradeLevelId: importFixture.gradeLevel.id,
        majorId: importFixture.major.id,
        name: "Rombel 2",
        sortOrder: 2,
      });
    });

    it("TC-12: Memproses XLSX 5 baris (valid, NIS kosong, duplikat file, Rombel 99, CSV injection =CMD|...) secara transaksional dengan laporan error akurat", async () => {
      setAuthRole("committee");

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet([
        { NIS: "2324099", Nama: "Budi", Rombel: "Rombel 1" }, // Row 2: Valid
        { NIS: "", Nama: "Siti", Rombel: "Rombel 1" }, // Row 3: Empty NIS
        { NIS: "2324099", Nama: "Budi 2", Rombel: "Rombel 2" }, // Row 4: Duplicate in payload
        { NIS: "2324100", Nama: "Andi", Rombel: "Rombel 99" }, // Row 5: Unregistered rombel
        { NIS: "2324101", Nama: "=CMD|' /C calc'!A0", Rombel: "Rombel 1" }, // Row 6: CSV formula injection
      ]);
      XLSX.utils.book_append_sheet(workbook, worksheet, "DPT");
      const xlsxBuffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Buffer;

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([new Uint8Array(xlsxBuffer)], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "dpt-tc12.xlsx"
      );
      formData.append("electionId", importElectionId);
      formData.append("autoCreateGroups", "false");

      const req = new NextRequest("http://localhost:3000/api/admin/voters/import", {
        method: "POST",
        headers: { cookie: committeeCookie },
        body: formData,
      });

      const res = await votersImportPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        success: boolean;
        data: {
          totalProcessed: number;
          insertedCount: number;
          failedCount: number;
          failures: Array<{
            rowNumber: number;
            voterIdentity: string;
            reason: string;
          }>;
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.totalProcessed).toBe(5);
      expect(json.data.insertedCount).toBe(1);
      expect(json.data.failedCount).toBe(4);
      expect(json.data.failures).toHaveLength(4);

      const emptyNisErr = json.data.failures.find(
        (f) => f.rowNumber === 3 && f.voterIdentity === "-"
      );
      const dupPayloadErr = json.data.failures.find(
        (f) => f.rowNumber === 4 && f.voterIdentity === "2324099"
      );
      const csvInjectionErr = json.data.failures.find(
        (f) => f.rowNumber === 6 && f.voterIdentity === "2324101"
      );
      const unregisteredGroupErr = json.data.failures.find(
        (f) => f.voterIdentity === "2324100"
      );

      expect(emptyNisErr?.reason).toContain("wajib diisi");
      expect(dupPayloadErr?.reason).toContain("duplikat di dalam file");
      expect(csvInjectionErr?.reason).toContain("CSV Formula Injection");
      expect(unregisteredGroupErr?.reason).toContain("belum terdaftar");

      // Verify transactional persistence in DB: ONLY valid row 2324099 persisted
      const persistedVoters = await db
        .select()
        .from(voters)
        .where(eq(voters.electionId, importElectionId));

      expect(persistedVoters).toHaveLength(1);
      expect(persistedVoters[0].voterIdentity).toBe("2324099");
      expect(persistedVoters[0].name).toBe("Budi");
      expect(persistedVoters[0].hasVoted).toBe(false);
      expect(persistedVoters[0].tokenHash).toBeTruthy();
      expect(persistedVoters[0].tokenEncrypted).not.toBe("[REDACTED]");

      // Verify unregistered group Rombel 99 was NOT created
      const [rombel99] = await db
        .select()
        .from(voterGroups)
        .where(
          and(
            eq(voterGroups.electionId, importElectionId),
            eq(voterGroups.name, "Rombel 99")
          )
        );
      expect(rombel99).toBeUndefined();

      // Verify audit log recorded inside the transaction
      const [importLog] = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.electionId, importElectionId),
            eq(auditLogs.action, "voters_bulk_imported")
          )
        )
        .limit(1);
      expect(importLog).toBeDefined();
    });

    it("TC-12: autoCreateGroups: true otomatis membuat master Rombel/Tingkat/Jurusan dan menolak duplikat DB", async () => {
      setAuthRole("committee");

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/voters/import",
        committeeCookie,
        {
          method: "POST",
          body: {
            electionId: importElectionId,
            autoCreateGroups: true,
            rows: [
              {
                voterIdentity: "2324100",
                name: "Andi",
                groupName: "Rombel 99",
                gradeName: "XII",
                majorName: "RPL",
              },
              {
                voterIdentity: "2324099",
                name: "Budi Duplikat DB",
                groupName: "Rombel 1",
              },
            ],
          },
        }
      );

      const res = await votersImportPost(req);
      expect(res.status).toBe(200);

      const json = (await res.json()) as {
        success: boolean;
        data: {
          totalProcessed: number;
          insertedCount: number;
          failedCount: number;
          failures: Array<{
            rowNumber: number;
            voterIdentity: string;
            reason: string;
          }>;
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.totalProcessed).toBe(2);
      expect(json.data.insertedCount).toBe(1);
      expect(json.data.failedCount).toBe(1);
      expect(json.data.failures[0].voterIdentity).toBe("2324099");
      expect(json.data.failures[0].reason).toContain("sudah terdaftar di database");

      const [createdGroup] = await db
        .select()
        .from(voterGroups)
        .where(
          and(
            eq(voterGroups.electionId, importElectionId),
            eq(voterGroups.name, "Rombel 99")
          )
        );
      const [createdGrade] = await db
        .select()
        .from(gradeLevels)
        .where(
          and(
            eq(gradeLevels.electionId, importElectionId),
            eq(gradeLevels.name, "XII")
          )
        );
      const [createdMajor] = await db
        .select()
        .from(majors)
        .where(
          and(
            eq(majors.electionId, importElectionId),
            eq(majors.name, "RPL")
          )
        );

      expect(createdGroup).toBeDefined();
      expect(createdGrade).toBeDefined();
      expect(createdMajor).toBeDefined();

      const [andi] = await db
        .select()
        .from(voters)
        .where(
          and(
            eq(voters.electionId, importElectionId),
            eq(voters.voterIdentity, "2324100")
          )
        );
      expect(andi).toBeDefined();
      expect(andi.groupId).toBe(createdGroup.id);
    });
  });

  // =========================================================================
  // 7. Audit Log Date Range Filtering (/api/admin/logs)
  // =========================================================================
  describe("7. Audit Log Date Filtering (/api/admin/logs)", () => {
    it("Menyertakan log pada hari yang sama saat dateFrom=dateTo (WIB) dan menolak tanggal invalid dengan 400", async () => {
      setAuthRole("committee");

      const todayWib = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
      }).format(new Date());

      const okReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/logs?electionId=${testElectionId}&dateFrom=${todayWib}&dateTo=${todayWib}&limit=100`,
        committeeCookie
      );
      const okRes = await logsGet(okReq);
      expect(okRes.status).toBe(200);
      const okJson = (await okRes.json()) as {
        success: boolean;
        data: { logs: Array<{ id: string }> };
      };
      expect(okJson.success).toBe(true);
      expect(okJson.data.logs.length).toBeGreaterThan(0);

      const badReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/logs?electionId=${testElectionId}&dateTo=not-a-date`,
        committeeCookie
      );
      const badRes = await logsGet(badReq);
      expect(badRes.status).toBe(400);
      const badJson = (await badRes.json()) as { error: { code: string } };
      expect(badJson.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // =========================================================================
  // 8. Bulk Delete Voters (/api/admin/voters)
  // =========================================================================
  describe("8. Bulk Delete Voters (/api/admin/voters)", () => {
    it("Menolak permintaan bulk delete pemilih jika dilakukan oleh committee (403 FORBIDDEN)", async () => {
      setAuthRole("committee");

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/voters",
        committeeCookie,
        {
          method: "DELETE",
          body: {
            electionId: testElectionId,
            allNotVoted: true,
          },
        }
      );

      const res = await votersDelete(req);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("Menolak bulk delete jika salah satu pemilih yang dipilih sudah memilih (409 VOTER_IMMUTABLE)", async () => {
      setAuthRole("super_admin");

      // Create 2 isolated voters: 1 unvoted, 1 voted
      const voter1 = await createIsolatedVoter({
        electionId: testElectionId,
        groupId: testGroupId,
        voterIdentity: `bulk_del_v1_${Date.now()}`,
        name: "Bulk Voter 1 (Belum Memilih)",
        hasVoted: false,
      });

      const voter2 = await createIsolatedVoter({
        electionId: testElectionId,
        groupId: testGroupId,
        voterIdentity: `bulk_del_v2_${Date.now()}`,
        name: "Bulk Voter 2 (Sudah Memilih)",
        hasVoted: true,
      });

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/voters",
        adminCookie,
        {
          method: "DELETE",
          body: {
            electionId: testElectionId,
            voterIds: [voter1.voter.id, voter2.voter.id],
          },
        }
      );

      const res = await votersDelete(req);
      expect(res.status).toBe(409);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("VOTER_IMMUTABLE");

      // Verify voter1 was not deleted
      const [check1] = await db
        .select()
        .from(voters)
        .where(eq(voters.id, voter1.voter.id));
      expect(check1).toBeDefined();
    });

    it("Super admin berhasil menghapus sebagian pemilih secara massal berdasarkan voterIds", async () => {
      setAuthRole("super_admin");

      const vA = await createIsolatedVoter({
        electionId: testElectionId,
        groupId: testGroupId,
        voterIdentity: `del_va_${Date.now()}`,
        name: "Voter To Delete A",
        hasVoted: false,
      });

      const vB = await createIsolatedVoter({
        electionId: testElectionId,
        groupId: testGroupId,
        voterIdentity: `del_vb_${Date.now()}`,
        name: "Voter To Delete B",
        hasVoted: false,
      });

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/voters",
        adminCookie,
        {
          method: "DELETE",
          body: {
            electionId: testElectionId,
            voterIds: [vA.voter.id, vB.voter.id],
          },
        }
      );

      const res = await votersDelete(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: { deletedCount: number } };
      expect(json.success).toBe(true);
      expect(json.data.deletedCount).toBe(2);

      // Verify they are deleted from DB
      const remaining = await db
        .select()
        .from(voters)
        .where(
          and(
            eq(voters.electionId, testElectionId),
            sql`${voters.id} in (${vA.voter.id}, ${vB.voter.id})`
          )
        );
      expect(remaining).toHaveLength(0);
    });

    it("Super admin berhasil menghapus semua pemilih yang belum memilih dengan allNotVoted: true tanpa menghapus yang sudah memilih", async () => {
      setAuthRole("super_admin");

      // Create isolated election fixture for this specific wipe test
      const wipeFixture = await createIsolatedElectionFixture({
        slug: `wipe-fixture-${Date.now()}`,
        title: "Wipe Election Test",
        isActive: false,
      });
      createdElectionIds.push(wipeFixture.election.id);

      // Create 3 unvoted voters and 1 voted voter
      const u1 = await createIsolatedVoter({
        electionId: wipeFixture.election.id,
        groupId: wipeFixture.group.id,
        voterIdentity: `wipe_u1_${Date.now()}`,
        name: "Unvoted 1",
        hasVoted: false,
      });
      const u2 = await createIsolatedVoter({
        electionId: wipeFixture.election.id,
        groupId: wipeFixture.group.id,
        voterIdentity: `wipe_u2_${Date.now()}`,
        name: "Unvoted 2",
        hasVoted: false,
      });
      const vDone = await createIsolatedVoter({
        electionId: wipeFixture.election.id,
        groupId: wipeFixture.group.id,
        voterIdentity: `wipe_v_done_${Date.now()}`,
        name: "Already Voted",
        hasVoted: true,
      });

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/voters",
        adminCookie,
        {
          method: "DELETE",
          body: {
            electionId: wipeFixture.election.id,
            allNotVoted: true,
          },
        }
      );

      const res = await votersDelete(req);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: { deletedCount: number } };
      expect(json.success).toBe(true);
      expect(json.data.deletedCount).toBe(2);

      // Verify unvoted are gone, but voted voter is still there
      const remaining = await db
        .select()
        .from(voters)
        .where(eq(voters.electionId, wipeFixture.election.id));
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(vDone.voter.id);
    });
  });
});
