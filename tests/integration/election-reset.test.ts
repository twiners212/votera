import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  accounts,
  auditLogs,
  candidates,
  db,
  elections,
  majors,
  sessions,
  users,
  voterGroups,
  voterSessions,
  voters,
  votes,
} from "@/db";
import {
  captureBaselineIds,
  cleanupTestArtifacts,
  createAdminNextRequest,
  createIsolatedElectionFixture,
  createIsolatedVoter,
  createPersistedVoterSession,
  signInSeedAdmin,
  type BaselineIds,
} from "../helpers/neon-test-harness";

// Mock next/headers so getAdminSession() reads the active test role cookie
let currentMockHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentMockHeaders,
}));

// Import route handler after mocking next/headers
import { POST as resetPost } from "@/app/api/admin/elections/reset/route";

describe("Hard Reset Pemilihan (Danger Zone) Integration Tests", () => {
  let baseline: BaselineIds;
  let adminCookie = "";
  let committeeCookie = "";
  let superAdminUserId = "";
  const createdElectionIds: string[] = [];
  const superAdminPassword =
    process.env.INITIAL_ADMIN_PASSWORD || "AdminPilketos2026!Secure";

  beforeAll(async () => {
    baseline = await captureBaselineIds();

    const adminAuth = await signInSeedAdmin("super_admin");
    adminCookie = adminAuth.cookie;
    superAdminUserId = adminAuth.userId ?? "";

    const committeeAuth = await signInSeedAdmin("committee");
    committeeCookie = committeeAuth.cookie;
  });

  afterAll(async () => {
    await cleanupTestArtifacts({
      baseline,
      electionIds: createdElectionIds,
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

  describe("1. Keamanan & RBAC (Role-Based Access Control)", () => {
    it("menolak akses anonim dengan HTTP 401 UNAUTHORIZED", async () => {
      setAuthRole("anonymous");

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("anonymous"),
        {
          method: "POST",
          body: {
            electionId: "550e8400-e29b-41d4-a716-446655440000",
            confirmationText: "RESET PEMILIHAN",
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("menolak peran panitia (committee) dengan HTTP 403 FORBIDDEN", async () => {
      setAuthRole("committee");

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("committee"),
        {
          method: "POST",
          body: {
            electionId: "550e8400-e29b-41d4-a716-446655440000",
            confirmationText: "RESET PEMILIHAN",
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FORBIDDEN");
    });
  });

  describe("2. Pra-Reset Status Guard & Validasi Input", () => {
    it("menolak reset jika password Super Admin salah dengan HTTP 401 INVALID_CREDENTIALS", async () => {
      setAuthRole("super_admin");

      const fixture = await createIsolatedElectionFixture({
        status: "closed",
        isActive: false,
      });
      createdElectionIds.push(fixture.election.id);

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId: fixture.election.id,
            confirmationText: "RESET PEMILIHAN",
            password: "WrongPassword999!",
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INVALID_CREDENTIALS");
      expect(json.error.message).toBe(
        "Password Super Admin salah. Tindakan dibatalkan."
      );
    });

    it("menolak reset jika password Super Admin tidak disertakan (HTTP 400 VALIDATION_ERROR)", async () => {
      setAuthRole("super_admin");

      const fixture = await createIsolatedElectionFixture({
        status: "closed",
        isActive: false,
      });
      createdElectionIds.push(fixture.election.id);

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId: fixture.election.id,
            confirmationText: "RESET PEMILIHAN",
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("menolak reset jika akun Super Admin tidak memiliki hash password di database (HTTP 401 INVALID_CREDENTIALS)", async () => {
      setAuthRole("super_admin");

      const [superAdminAccount] = await db
        .select({ id: accounts.id, password: accounts.password })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, superAdminUserId),
            eq(accounts.providerId, "credential"),
            isNotNull(accounts.password)
          )
        )
        .limit(1);

      expect(superAdminAccount).toBeDefined();
      const originalPassword = superAdminAccount.password;

      // Ubah password di DB menjadi null sementara untuk mensimulasikan akun tanpa password kredensial
      await db
        .update(accounts)
        .set({ password: null })
        .where(eq(accounts.id, superAdminAccount.id));

      const fixture = await createIsolatedElectionFixture({
        status: "closed",
        isActive: false,
      });
      createdElectionIds.push(fixture.election.id);

      try {
        const req = createAdminNextRequest(
          "http://localhost:3000/api/admin/elections/reset",
          activeCookie("super_admin"),
          {
            method: "POST",
            body: {
              electionId: fixture.election.id,
              confirmationText: "RESET PEMILIHAN",
              password: superAdminPassword,
            },
          }
        );

        const res = await resetPost(req);
        expect(res.status).toBe(401);

        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe("INVALID_CREDENTIALS");
        expect(json.error.message).toBe(
          "Password Super Admin salah. Tindakan dibatalkan."
        );
      } finally {
        // Kembalikan hash password asli agar suite berikutnya tidak terpengaruh
        await db
          .update(accounts)
          .set({ password: originalPassword })
          .where(eq(accounts.id, superAdminAccount.id));
      }
    });

    it("menolak reset jika status pemilihan 'open' (aktif) dengan pesan informatif", async () => {
      setAuthRole("super_admin");

      const fixture = await createIsolatedElectionFixture({
        status: "open",
        isActive: false,
      });
      createdElectionIds.push(fixture.election.id);

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId: fixture.election.id,
            confirmationText: "RESET PEMILIHAN",
            password: superAdminPassword,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("BAD_REQUEST");
      expect(json.error.message).toBe(
        "Pemilihan sedang aktif. Ubah status ke paused atau closed terlebih dahulu."
      );
    });

    it("menolak jika teks konfirmasi bukan 'RESET PEMILIHAN'", async () => {
      setAuthRole("super_admin");

      const fixture = await createIsolatedElectionFixture({
        status: "closed",
        isActive: false,
      });
      createdElectionIds.push(fixture.election.id);

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId: fixture.election.id,
            confirmationText: "SALAH KONFIRMASI",
            password: superAdminPassword,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("menolak jika electionId tidak ditemukan di database (404 NOT_FOUND)", async () => {
      setAuthRole("super_admin");

      const nonExistentUuid = "a0000000-0000-0000-0000-000000000000";

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId: nonExistentUuid,
            confirmationText: "RESET PEMILIHAN",
            password: superAdminPassword,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NOT_FOUND");
    });
  });

  describe("3. Eksekusi Reset Standar (Hapus Suara & DPT Saja)", () => {
    it("mengosongkan votes, voterSessions, dan voters serta mengembalikan status ke draft tanpa menghapus master data dan kandidat", async () => {
      setAuthRole("super_admin");

      // 1. Buat fixture pemilihan dengan status 'closed'
      const fixture = await createIsolatedElectionFixture({
        status: "closed",
        isActive: false,
        activeCandidateCount: 2,
      });
      const electionId = fixture.election.id;
      createdElectionIds.push(electionId);

      // 2. Tambahkan pemilih dan sesi pemilih
      const isolatedVoter = await createIsolatedVoter({
        electionId,
        groupId: fixture.group.id,
        voterIdentity: "RESET-VOTER-1",
        hasVoted: true,
        voterStatus: "voted",
      });

      await createPersistedVoterSession({
        electionId,
        voterId: isolatedVoter.voter.id,
      });

      // 3. Masukkan suara ke tabel votes
      await db.insert(votes).values({
        electionId,
        candidateId: fixture.candidateActive.id,
      });

      // Verifikasi data awal sebelum reset
      const preVotes = await db
        .select()
        .from(votes)
        .where(eq(votes.electionId, electionId));
      expect(preVotes.length).toBe(1);

      const preVoters = await db
        .select()
        .from(voters)
        .where(eq(voters.electionId, electionId));
      expect(preVoters.length).toBe(1);

      const preCandidates = await db
        .select()
        .from(candidates)
        .where(eq(candidates.electionId, electionId));
      expect(preCandidates.length).toBeGreaterThan(0);

      // 4. Jalankan Reset Standar (deleteMasterData: false, deleteCandidates: false)
      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId,
            confirmationText: "RESET PEMILIHAN",
            password: superAdminPassword,
            deleteMasterData: false,
            deleteCandidates: false,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("draft");
      expect(json.data.deletedEntities).toEqual([
        "votes",
        "voter_sessions",
        "voters",
      ]);

      // 5. Verifikasi database: votes, voter_sessions, dan voters bersih
      const postVotes = await db
        .select()
        .from(votes)
        .where(eq(votes.electionId, electionId));
      expect(postVotes.length).toBe(0);

      const postSessions = await db
        .select()
        .from(voterSessions)
        .where(eq(voterSessions.electionId, electionId));
      expect(postSessions.length).toBe(0);

      const postVoters = await db
        .select()
        .from(voters)
        .where(eq(voters.electionId, electionId));
      expect(postVoters.length).toBe(0);

      // 6. Verifikasi kandidat, rombel, dan jurusan TETAP UTUH
      const postCandidates = await db
        .select()
        .from(candidates)
        .where(eq(candidates.electionId, electionId));
      expect(postCandidates.length).toBe(preCandidates.length);

      const postGroups = await db
        .select()
        .from(voterGroups)
        .where(eq(voterGroups.electionId, electionId));
      expect(postGroups.length).toBeGreaterThan(0);

      const postMajors = await db
        .select()
        .from(majors)
        .where(eq(majors.electionId, electionId));
      expect(postMajors.length).toBeGreaterThan(0);

      // 7. Status pemilihan berubah menjadi 'draft'
      const [updatedElection] = await db
        .select()
        .from(elections)
        .where(eq(elections.id, electionId));
      expect(updatedElection.status).toBe("draft");

      // 8. Audit log tercatat
      const [resetAudit] = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.electionId, electionId),
            eq(auditLogs.action, "election_data_reset")
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);

      expect(resetAudit).toBeDefined();
      expect(resetAudit.actionTitle).toBe("Data Pemilihan Direset");
      expect(resetAudit.description).toContain("votes, voter_sessions, voters");
      expect(resetAudit.description).toContain("dikembalikan ke draft");
    });
  });

  describe("4. Eksekusi Reset Menyeluruh (Termasuk Rombel, Jurusan, dan Kandidat)", () => {
    it("menghapus seluruh entitas pemilihan dan mencatat audit trail secara lengkap", async () => {
      setAuthRole("super_admin");

      // 1. Buat fixture baru
      const fixture = await createIsolatedElectionFixture({
        status: "draft",
        isActive: false,
        activeCandidateCount: 1,
      });
      const electionId = fixture.election.id;
      createdElectionIds.push(electionId);

      // 2. Tambahkan pemilih dan suara
      const isolatedVoter = await createIsolatedVoter({
        electionId,
        groupId: fixture.group.id,
        voterIdentity: "RESET-FULL-1",
        hasVoted: true,
        voterStatus: "voted",
      });

      await createPersistedVoterSession({
        electionId,
        voterId: isolatedVoter.voter.id,
      });

      await db.insert(votes).values({
        electionId,
        candidateId: fixture.candidateActive.id,
      });

      // 3. Jalankan reset menyeluruh
      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId,
            confirmationText: "RESET PEMILIHAN",
            password: superAdminPassword,
            deleteMasterData: true,
            deleteCandidates: true,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deletedEntities).toEqual([
        "votes",
        "voter_sessions",
        "voters",
        "voter_groups",
        "majors",
        "candidates",
      ]);

      // 4. Verifikasi seluruh tabel terkait kosong untuk pemilihan ini
      const postVotes = await db
        .select()
        .from(votes)
        .where(eq(votes.electionId, electionId));
      expect(postVotes.length).toBe(0);

      const postVoters = await db
        .select()
        .from(voters)
        .where(eq(voters.electionId, electionId));
      expect(postVoters.length).toBe(0);

      const postCandidates = await db
        .select()
        .from(candidates)
        .where(eq(candidates.electionId, electionId));
      expect(postCandidates.length).toBe(0);

      const postGroups = await db
        .select()
        .from(voterGroups)
        .where(eq(voterGroups.electionId, electionId));
      expect(postGroups.length).toBe(0);

      const postMajors = await db
        .select()
        .from(majors)
        .where(eq(majors.electionId, electionId));
      expect(postMajors.length).toBe(0);

      // 5. Audit log mencatat entitas yang dihapus
      const [resetAudit] = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.electionId, electionId),
            eq(auditLogs.action, "election_data_reset")
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(1);

      expect(resetAudit).toBeDefined();
      expect(resetAudit.description).toContain(
        "votes, voter_sessions, voters, voter_groups, majors, candidates"
      );
    });
  });

  describe("5. Cakupan Penghapusan Selektif & Imutabilitas Audit Log", () => {
    it("menghapus master data (rombel & jurusan) namun MEMPERTAHANKAN kandidat saat deleteMasterData=true, deleteCandidates=false", async () => {
      setAuthRole("super_admin");

      const fixture = await createIsolatedElectionFixture({
        status: "closed",
        isActive: false,
        activeCandidateCount: 2,
      });
      const electionId = fixture.election.id;
      createdElectionIds.push(electionId);

      const isolatedVoter = await createIsolatedVoter({
        electionId,
        groupId: fixture.group.id,
        voterIdentity: "RESET-PARTIAL-M1",
        hasVoted: true,
        voterStatus: "voted",
      });

      await createPersistedVoterSession({
        electionId,
        voterId: isolatedVoter.voter.id,
      });

      await db.insert(votes).values({
        electionId,
        candidateId: fixture.candidateActive.id,
      });

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId,
            confirmationText: "RESET PEMILIHAN",
            password: superAdminPassword,
            deleteMasterData: true,
            deleteCandidates: false,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deletedEntities).toEqual([
        "votes",
        "voter_sessions",
        "voters",
        "voter_groups",
        "majors",
      ]);

      // Suara & pemilih terhapus
      const postVotes = await db.select().from(votes).where(eq(votes.electionId, electionId));
      expect(postVotes.length).toBe(0);
      const postVoters = await db.select().from(voters).where(eq(voters.electionId, electionId));
      expect(postVoters.length).toBe(0);

      // Rombel & jurusan terhapus
      const postGroups = await db.select().from(voterGroups).where(eq(voterGroups.electionId, electionId));
      expect(postGroups.length).toBe(0);
      const postMajors = await db.select().from(majors).where(eq(majors.electionId, electionId));
      expect(postMajors.length).toBe(0);

      // Kandidat TETAP ADA (2 aktif + 1 nonaktif dari fixture = 3)
      const postCandidates = await db.select().from(candidates).where(eq(candidates.electionId, electionId));
      expect(postCandidates.length).toBe(3);
    });

    it("menghapus kandidat namun MEMPERTAHANKAN master data saat deleteCandidates=true, deleteMasterData=false", async () => {
      setAuthRole("super_admin");

      const fixture = await createIsolatedElectionFixture({
        status: "closed",
        isActive: false,
        activeCandidateCount: 2,
      });
      const electionId = fixture.election.id;
      createdElectionIds.push(electionId);

      const isolatedVoter = await createIsolatedVoter({
        electionId,
        groupId: fixture.group.id,
        voterIdentity: "RESET-PARTIAL-C1",
        hasVoted: true,
        voterStatus: "voted",
      });

      await createPersistedVoterSession({
        electionId,
        voterId: isolatedVoter.voter.id,
      });

      await db.insert(votes).values({
        electionId,
        candidateId: fixture.candidateActive.id,
      });

      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId,
            confirmationText: "RESET PEMILIHAN",
            password: superAdminPassword,
            deleteMasterData: false,
            deleteCandidates: true,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.deletedEntities).toEqual([
        "votes",
        "voter_sessions",
        "voters",
        "candidates",
      ]);

      // Kandidat terhapus
      const postCandidates = await db.select().from(candidates).where(eq(candidates.electionId, electionId));
      expect(postCandidates.length).toBe(0);

      // Rombel & jurusan TETAP ADA
      const postGroups = await db.select().from(voterGroups).where(eq(voterGroups.electionId, electionId));
      expect(postGroups.length).toBeGreaterThan(0);
      const postMajors = await db.select().from(majors).where(eq(majors.electionId, electionId));
      expect(postMajors.length).toBeGreaterThan(0);
    });

    it("menjamin audit_logs SEBELUM reset tetap utuh dan bertambah dengan entri baru (append-only enforcement)", async () => {
      setAuthRole("super_admin");

      const fixture = await createIsolatedElectionFixture({
        status: "draft",
        isActive: false,
      });
      const electionId = fixture.election.id;
      createdElectionIds.push(electionId);

      // Buat entri audit log buatan sebelum reset
      await db.insert(auditLogs).values({
        electionId,
        actorType: "admin",
        actorName: "Super Admin",
        actorIdentity: "@admin",
        action: "pre_reset_test_action",
        actionTitle: "Uji Pra Reset",
        description: "Log awal sebelum aksi reset dieksekusi",
        ipAddress: "127.0.0.1",
      });

      const preLogs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.electionId, electionId));
      expect(preLogs.length).toBeGreaterThanOrEqual(1);
      const preLogCount = preLogs.length;

      // Jalankan reset
      const req = createAdminNextRequest(
        "http://localhost:3000/api/admin/elections/reset",
        activeCookie("super_admin"),
        {
          method: "POST",
          body: {
            electionId,
            confirmationText: "RESET PEMILIHAN",
            password: superAdminPassword,
          },
        }
      );

      const res = await resetPost(req);
      expect(res.status).toBe(200);

      // Verifikasi: Semua log sebelum reset MASIH ADA, dan jumlahnya bertambah 1
      const postLogs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.electionId, electionId))
        .orderBy(desc(auditLogs.createdAt));

      expect(postLogs.length).toBe(preLogCount + 1);

      // Log lama tetap ada
      const oldLog = postLogs.find((l) => l.action === "pre_reset_test_action");
      expect(oldLog).toBeDefined();
      expect(oldLog?.description).toBe("Log awal sebelum aksi reset dieksekusi");

      // Log baru adalah reset action
      const newLog = postLogs.find((l) => l.action === "election_data_reset");
      expect(newLog).toBeDefined();
      expect(newLog?.actionTitle).toBe("Data Pemilihan Direset");
    });
  });
});
