import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { accounts, db, sessions, users } from "@/db";
import { hashPassword } from "better-auth/crypto";
import {
  captureBaselineIds,
  cleanupTestArtifacts,
  createAdminNextRequest,
  signInAdminWithUsername,
  signInSeedAdmin,
  type BaselineIds,
} from "../helpers/neon-test-harness";

let currentMockHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentMockHeaders,
}));

import { PATCH as userIdPatch } from "@/app/api/admin/users/[id]/route";
import { GET as usersGet } from "@/app/api/admin/users/route";
import { GET as candidatesGet } from "@/app/api/admin/candidates/route";

describe("Admin Session Management & Security Policies", () => {
  let baseline: BaselineIds;
  let superAdminCookie = "";
  let superAdminUserId = "";
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    baseline = await captureBaselineIds();

    const adminAuth = await signInSeedAdmin("super_admin");
    superAdminCookie = adminAuth.cookie;
    superAdminUserId = adminAuth.userId!;
  });

  afterAll(async () => {
    // Clean up any test users created during the suite
    for (const uId of createdUserIds) {
      await db.delete(sessions).where(eq(sessions.userId, uId));
      await db.delete(accounts).where(eq(accounts.userId, uId));
      await db.delete(users).where(eq(users.id, uId));
    }

    await cleanupTestArtifacts({
      baseline,
    });
  });

  function setSuperAdminAuth() {
    currentMockHeaders = new Headers({ cookie: superAdminCookie });
  }

  describe("1. Single-Device Enforcement for Super Admin", () => {
    it("menghapus sesi lama secara otomatis ketika super_admin login kembali", async () => {
      // Login pertama sebagai super_admin
      const firstLogin = await signInSeedAdmin("super_admin");
      expect(firstLogin.cookie).toBeTruthy();

      const sessionsAfterFirst = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, superAdminUserId));
      expect(sessionsAfterFirst.length).toBe(1);
      const firstSessionId = sessionsAfterFirst[0].id;

      // Verifikasi sesi pertama dapat mengakses endpoint super_admin
      currentMockHeaders = new Headers({ cookie: firstLogin.cookie });
      const firstAccessRes = await usersGet();
      expect(firstAccessRes.status).toBe(200);

      // Login kedua sebagai super_admin
      const secondLogin = await signInSeedAdmin("super_admin");
      expect(secondLogin.cookie).toBeTruthy();

      // Verifikasi: Hanya ada 1 sesi aktif di DB, dan ID-nya BUKAN session pertama
      const sessionsAfterSecond = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, superAdminUserId));
      expect(sessionsAfterSecond.length).toBe(1);
      expect(sessionsAfterSecond[0].id).not.toBe(firstSessionId);

      // Verifikasi sesi baru (kedua) dapat mengakses endpoint
      currentMockHeaders = new Headers({ cookie: secondLogin.cookie });
      const secondAccessRes = await usersGet();
      expect(secondAccessRes.status).toBe(200);

      // Verifikasi sesi lama (pertama) SEKARANG DITOLAK (401 UNAUTHORIZED)
      currentMockHeaders = new Headers({ cookie: firstLogin.cookie });
      const oldSessionRes = await usersGet();
      expect(oldSessionRes.status).toBe(401);
      const oldSessionJson = await oldSessionRes.json();
      expect(oldSessionJson.error?.code).toBe("UNAUTHORIZED");

      // Perbarui superAdminCookie untuk test berikutnya
      superAdminCookie = secondLogin.cookie;
    });

    it("menangani login konkuren dari super_admin dan tetap hanya mempertahankan 1 sesi aktif", async () => {
      // Jalankan 3 login paralel simultan untuk super_admin
      const results = await Promise.all([
        signInSeedAdmin("super_admin"),
        signInSeedAdmin("super_admin"),
        signInSeedAdmin("super_admin"),
      ]);

      expect(results.every((r) => Boolean(r.cookie))).toBe(true);

      // Verifikasi: Di database hanya tersisa tepat 1 sesi aktif
      const sessionsInDb = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, superAdminUserId));
      expect(sessionsInDb.length).toBe(1);

      // Update superAdminCookie dengan sesi yang masih valid di DB
      const validSession = sessionsInDb[0];
      expect(validSession).toBeDefined();

      // Cari cookie mana yang cocok dengan sesi aktif yang tersisa di DB
      let workingCookie = "";
      for (const res of results) {
        currentMockHeaders = new Headers({ cookie: res.cookie });
        const check = await usersGet();
        if (check.status === 200) {
          workingCookie = res.cookie;
        }
      }
      expect(workingCookie).toBeTruthy();
      superAdminCookie = workingCookie;
    });
  });

  describe("2. Multi-Device Preservation for Committee", () => {
    it("mempertahankan seluruh sesi aktif ketika panitia (committee) login dari beberapa perangkat", async () => {
      // Dapatkan user ID panitia
      const [committeeUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, "panitia"))
        .limit(1);
      expect(committeeUser).toBeDefined();
      const committeeUserId = committeeUser.id;

      // Bersihkan sesi lama panitia agar tes deterministik
      await db.delete(sessions).where(eq(sessions.userId, committeeUserId));

      // Login pertama panitia
      const firstLogin = await signInSeedAdmin("committee");
      expect(firstLogin.cookie).toBeTruthy();

      const sessionsAfterFirst = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, committeeUserId));
      expect(sessionsAfterFirst.length).toBe(1);

      // Login kedua panitia (simulasi perangkat kedua di lapangan)
      const secondLogin = await signInSeedAdmin("committee");
      expect(secondLogin.cookie).toBeTruthy();

      // Verifikasi: KEDUA sesi aktif tetap dipertahankan di DB
      const sessionsAfterSecond = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, committeeUserId));
      expect(sessionsAfterSecond.length).toBe(2);

      const sessionIds = sessionsAfterSecond.map((s) => s.id);
      expect(new Set(sessionIds).size).toBe(2);

      // Verifikasi: KEDUA cookie perangkat tetap berhasil autentikasi ke API
      currentMockHeaders = new Headers({ cookie: firstLogin.cookie });
      const firstReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/candidates",
        firstLogin.cookie
      );
      const res1 = await candidatesGet(firstReq);
      // Status bukan 401/403 (lolos autentikasi sesi panitia)
      expect(res1.status).not.toBe(401);
      expect(res1.status).not.toBe(403);

      currentMockHeaders = new Headers({ cookie: secondLogin.cookie });
      const secondReq = createAdminNextRequest(
        "http://localhost:3000/api/admin/candidates",
        secondLogin.cookie
      );
      const res2 = await candidatesGet(secondReq);
      expect(res2.status).not.toBe(401);
      expect(res2.status).not.toBe(403);
    });
  });

  describe("3. Full Session Revocation on Password Change or Account Ban", () => {
    it("menghapus seluruh sesi aktif pengguna ketika password diubah lewat PATCH /api/admin/users/[id]", async () => {
      setSuperAdminAuth();

      // Buat akun panitia dummy untuk pengujian
      const testUserId = crypto.randomUUID();
      createdUserIds.push(testUserId);
      const testUsername = `user_pw_test_${Date.now().toString().slice(-6)}`;
      const initialPassword = "InitialPassword123!";
      const hashedPassword = await hashPassword(initialPassword);

      await db.insert(users).values({
        id: testUserId,
        name: "Test Session Reset",
        email: `${testUsername}@example.com`,
        emailVerified: true,
        username: testUsername,
        displayUsername: "Test Session Reset",
        role: "committee",
        banned: false,
      });

      await db.insert(accounts).values({
        id: crypto.randomUUID(),
        accountId: testUserId,
        providerId: "credential",
        userId: testUserId,
        password: hashedPassword,
      });

      // Login akun dummy untuk membuat sesi aktif
      const loginRes1 = await signInAdminWithUsername({
        username: testUsername,
        password: initialPassword,
      });
      expect(loginRes1.cookie).toBeTruthy();

      // Login kedua untuk membuat sesi kedua
      const loginRes2 = await signInAdminWithUsername({
        username: testUsername,
        password: initialPassword,
      });
      expect(loginRes2.cookie).toBeTruthy();

      const activeSessionsBefore = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));
      expect(activeSessionsBefore.length).toBe(2);

      // Super admin mengubah password akun tersebut
      const newPassword = "NewSecurePassword2026!";
      const patchReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${testUserId}`,
        superAdminCookie,
        {
          method: "PATCH",
          body: {
            password: newPassword,
          },
        }
      );

      const patchRes = await userIdPatch(patchReq, {
        params: Promise.resolve({ id: testUserId }),
      });
      expect(patchRes.status).toBe(200);

      // Verifikasi: Seluruh sesi aktif pengguna terhapus seketika
      const activeSessionsAfter = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));
      expect(activeSessionsAfter.length).toBe(0);

      // Verifikasi: Seluruh cookie sesi lama ditolak seketika (401 UNAUTHORIZED)
      currentMockHeaders = new Headers({ cookie: loginRes1.cookie });
      const probe1 = await candidatesGet(
        createAdminNextRequest(
          "http://localhost:3000/api/admin/candidates",
          loginRes1.cookie
        )
      );
      expect(probe1.status).toBe(401);

      currentMockHeaders = new Headers({ cookie: loginRes2.cookie });
      const probe2 = await candidatesGet(
        createAdminNextRequest(
          "http://localhost:3000/api/admin/candidates",
          loginRes2.cookie
        )
      );
      expect(probe2.status).toBe(401);

      // Verifikasi pengguna dapat login dengan password baru
      const newLogin = await signInAdminWithUsername({
        username: testUsername,
        password: newPassword,
      });
      expect(newLogin.cookie).toBeTruthy();

      // Verifikasi sesi login baru dapat mengakses API
      currentMockHeaders = new Headers({ cookie: newLogin.cookie });
      const newAccessRes = await candidatesGet(
        createAdminNextRequest(
          "http://localhost:3000/api/admin/candidates",
          newLogin.cookie
        )
      );
      expect(newAccessRes.status).not.toBe(401);
    });

    it("menghapus seluruh sesi aktif pengguna ketika akun diblokir (banned: true)", async () => {
      setSuperAdminAuth();

      // Buat akun panitia dummy kedua
      const testUserId = crypto.randomUUID();
      createdUserIds.push(testUserId);
      const testUsername = `user_ban_test_${Date.now().toString().slice(-6)}`;
      const testPassword = "BanTestPassword123!";
      const hashedPassword = await hashPassword(testPassword);

      await db.insert(users).values({
        id: testUserId,
        name: "Test Ban Session Revoke",
        email: `${testUsername}@example.com`,
        emailVerified: true,
        username: testUsername,
        displayUsername: "Test Ban Session Revoke",
        role: "committee",
        banned: false,
      });

      await db.insert(accounts).values({
        id: crypto.randomUUID(),
        accountId: testUserId,
        providerId: "credential",
        userId: testUserId,
        password: hashedPassword,
      });

      // Login untuk membuat sesi aktif
      const loginRes = await signInAdminWithUsername({
        username: testUsername,
        password: testPassword,
      });
      expect(loginRes.cookie).toBeTruthy();

      const activeSessionsBefore = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));
      expect(activeSessionsBefore.length).toBe(1);

      // Super admin memblokir akun (banned: true)
      const patchReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${testUserId}`,
        superAdminCookie,
        {
          method: "PATCH",
          body: {
            banned: true,
          },
        }
      );

      const patchRes = await userIdPatch(patchReq, {
        params: Promise.resolve({ id: testUserId }),
      });
      expect(patchRes.status).toBe(200);

      // Verifikasi: Sesi aktif pengguna terhapus seketika
      const activeSessionsAfter = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));
      expect(activeSessionsAfter.length).toBe(0);

      // Verifikasi: Cookie sesi lama ditolak seketika (401 UNAUTHORIZED)
      currentMockHeaders = new Headers({ cookie: loginRes.cookie });
      const probeBan = await candidatesGet(
        createAdminNextRequest(
          "http://localhost:3000/api/admin/candidates",
          loginRes.cookie
        )
      );
      expect(probeBan.status).toBe(401);

      // Verifikasi: Pengguna yang diblokir tidak bisa login kembali
      await expect(
        signInAdminWithUsername({
          username: testUsername,
          password: testPassword,
        })
      ).rejects.toThrow();
    });

    it("tidak menghapus sesi aktif jika pembaruan akun non-destruktif (hanya mengubah nama)", async () => {
      setSuperAdminAuth();

      // Buat akun dummy ketiga
      const testUserId = crypto.randomUUID();
      createdUserIds.push(testUserId);
      const testUsername = `user_name_test_${Date.now().toString().slice(-6)}`;
      const testPassword = "NameTestPassword123!";
      const hashedPassword = await hashPassword(testPassword);

      await db.insert(users).values({
        id: testUserId,
        name: "Nama Awal",
        email: `${testUsername}@example.com`,
        emailVerified: true,
        username: testUsername,
        displayUsername: "Nama Awal",
        role: "committee",
        banned: false,
      });

      await db.insert(accounts).values({
        id: crypto.randomUUID(),
        accountId: testUserId,
        providerId: "credential",
        userId: testUserId,
        password: hashedPassword,
      });

      // Login untuk membuat sesi aktif
      const loginRes = await signInAdminWithUsername({
        username: testUsername,
        password: testPassword,
      });
      expect(loginRes.cookie).toBeTruthy();

      const activeSessionsBefore = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));
      expect(activeSessionsBefore.length).toBe(1);

      // Super admin mengubah hanya nama (bukan password atau ban)
      const patchReq = createAdminNextRequest(
        `http://localhost:3000/api/admin/users/${testUserId}`,
        superAdminCookie,
        {
          method: "PATCH",
          body: {
            name: "Nama Diperbarui",
          },
        }
      );

      const patchRes = await userIdPatch(patchReq, {
        params: Promise.resolve({ id: testUserId }),
      });
      expect(patchRes.status).toBe(200);

      // Verifikasi: Sesi aktif TIDAK terhapus
      const activeSessionsAfter = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, testUserId));
      expect(activeSessionsAfter.length).toBe(1);
      expect(activeSessionsAfter[0].id).toBe(activeSessionsBefore[0].id);
    });
  });
});
