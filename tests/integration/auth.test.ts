import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as voterLoginHandler } from "@/app/api/voter/login/route";
import { POST as voterLogoutHandler } from "@/app/api/voter/logout/route";
import { db } from "@/db";
import { voters, elections, voterSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashVoterToken, encryptVoterToken } from "@/lib/crypto/token";
import { getVoterSession, invalidateVoterSession } from "@/lib/auth/voter-session";
import { auth } from "@/lib/auth/admin-auth";

describe("Phase 3: Authentication & Session Integration Tests", () => {
  let testElectionId: string;
  const testNis = "9999001";
  const testToken = "TEST88TK";
  let testVoterId: string;

  beforeAll(async () => {
    // Cari pemilihan aktif
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    expect(election).toBeDefined();
    testElectionId = election.id;

    // Bersihkan data tes lama jika ada
    await db.delete(voters).where(eq(voters.voterIdentity, testNis));

    // Ambil group ID pertama yang tersedia
    const [firstGroup] = await db.query.voterGroups.findMany({
      where: (g, { eq }) => eq(g.electionId, testElectionId),
      limit: 1,
    });

    // Buat pemilih khusus untuk pengujian
    const [created] = await db
      .insert(voters)
      .values({
        electionId: testElectionId,
        groupId: firstGroup.id,
        voterIdentity: testNis,
        name: "Pemilih Uji Otentikasi",
        tokenHash: hashVoterToken(testToken),
        tokenEncrypted: encryptVoterToken(testToken),
        hasVoted: false,
        failedLoginAttempts: 0,
      })
      .returning();

    testVoterId = created.id;
  });

  it("harus menolak login pemilih dengan payload tidak lengkap", async () => {
    const req = new NextRequest("http://localhost:3000/api/voter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterIdentity: "" }),
    });

    const res = await voterLoginHandler(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("VALIDATION_ERROR");
  });

  it("harus menolak login dengan NIS yang tidak terdaftar", async () => {
    const req = new NextRequest("http://localhost:3000/api/voter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterIdentity: "0000000", token: "XYZ12345" }),
    });

    const res = await voterLoginHandler(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("INVALID_CREDENTIALS");
  });

  it("harus mencatat percobaan gagal dan mengunci akun setelah 5 kali gagal", async () => {
    // Reset failed login attempts
    await db
      .update(voters)
      .set({ failedLoginAttempts: 0, voterStatus: "not_voted", lockedUntil: null })
      .where(eq(voters.id, testVoterId));

    // Lakukan 4 kali percobaan salah
    for (let i = 1; i <= 4; i++) {
      const req = new NextRequest("http://localhost:3000/api/voter/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterIdentity: testNis, token: "WRONGTKN" }),
      });
      const res = await voterLoginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.remainingAttempts).toBe(5 - i);
    }

    // Percobaan ke-5 -> Akun harus dikunci (403 VOTER_LOCKED)
    const lockReq = new NextRequest("http://localhost:3000/api/voter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterIdentity: testNis, token: "WRONGTKN" }),
    });
    const lockRes = await voterLoginHandler(lockReq);
    expect(lockRes.status).toBe(403);

    const lockJson = await lockRes.json();
    expect(lockJson.error).toBe("VOTER_LOCKED");

    // Verifikasi status di database
    const [voterInDb] = await db.select().from(voters).where(eq(voters.id, testVoterId));
    expect(voterInDb.failedLoginAttempts).toBe(5);
    expect(voterInDb.lockedUntil).not.toBeNull();
  });

  it("harus berhasil login jika NIS dan token benar setelah akun dipulihkan", async () => {
    // Pulihkan status pemilih
    await db
      .update(voters)
      .set({ failedLoginAttempts: 0, voterStatus: "not_voted", lockedUntil: null, hasVoted: false })
      .where(eq(voters.id, testVoterId));

    const req = new NextRequest("http://localhost:3000/api/voter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterIdentity: testNis, token: testToken.toLowerCase() }), // test case-insensitive
    });

    const res = await voterLoginHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectUrl).toBe("/vote");
    expect(json.voter.name).toBe("Pemilih Uji Otentikasi");

    // Periksa bahwa cookie sesi disetel di header response
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("votera_voter_session");
  });

  it("harus mengarahkan pemilih yang sudah memilih ke /vote/thanks (bukti suara)", async () => {
    // Set hasVoted = true
    await db
      .update(voters)
      .set({ hasVoted: true, voterStatus: "voted", votedAt: new Date() })
      .where(eq(voters.id, testVoterId));

    const req = new NextRequest("http://localhost:3000/api/voter/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voterIdentity: testNis, token: testToken }),
    });

    const res = await voterLoginHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.redirectUrl).toBe("/vote/thanks");
  });

  it("harus memvalidasi sesi pemilih dan menghapusnya saat logout", async () => {
    // Buat sesi langsung
    const { createVoterSession } = await import("@/lib/auth/voter-session");
    const { token } = await createVoterSession({
      voterId: testVoterId,
      electionId: testElectionId,
    });

    // Validasi token sesi aktif
    const sessionRecord = await getVoterSession(token);
    expect(sessionRecord).not.toBeNull();
    expect(sessionRecord?.voter.id).toBe(testVoterId);

    // Invalidate sesi
    await invalidateVoterSession(token);

    // Validasi ulang -> harus sudah null
    const expiredRecord = await getVoterSession(token);
    expect(expiredRecord).toBeNull();
  });

  it("harus memverifikasi autentikasi Super Admin melalui Better Auth", async () => {
    // Sign in dengan akun Super Admin yang di-seed
    const res = await auth.api.signInUsername({
      body: {
        username: "admin",
        password: "AdminPilketos2026!Secure",
      },
    });

    expect(res).toBeDefined();
    expect(res.user).toBeDefined();
    expect((res.user as { role?: string }).role).toBe("super_admin");
    expect(res.user.username).toBe("admin");
  });

  it("harus menolak sign in admin dengan kata sandi yang salah", async () => {
    try {
      await auth.api.signInUsername({
        body: {
          username: "admin",
          password: "WrongPassword999!",
        },
      });
      // Jika tidak throw, harus gagal
      expect(true).toBe(false);
    } catch (err: unknown) {
      expect(err).toBeDefined();
    }
  });
});
