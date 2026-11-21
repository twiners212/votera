import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, elections, votes } from "@/db";
import {
  captureBaselineIds,
  cleanupTestArtifacts,
  createAdminNextRequest,
  createIsolatedElectionFixture,
  createIsolatedVoter,
  signInSeedAdmin,
  type BaselineIds,
} from "../helpers/neon-test-harness";

let currentMockHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentMockHeaders,
}));

import { PUT as settingsPut } from "@/app/api/admin/settings/route";
import {
  PATCH as candidatePatch,
  DELETE as candidateDelete,
} from "@/app/api/admin/candidates/[id]/route";

describe("Critical Admin Safeguards (Mode Open & Vote-Aware Rules)", () => {
  let baseline: BaselineIds;
  let adminCookie = "";
  let fixture: Awaited<ReturnType<typeof createIsolatedElectionFixture>>;
  const createdElectionIds: string[] = [];

  beforeAll(async () => {
    baseline = await captureBaselineIds();
    const adminAuth = await signInSeedAdmin("super_admin");
    adminCookie = adminAuth.cookie;
    currentMockHeaders = new Headers({ cookie: adminCookie });

    fixture = await createIsolatedElectionFixture({
      shortName: "PILKETOS-SAFEGUARD",
      title: "Pemilihan Safeguard 2026",
      status: "open",
      startAt: new Date(Date.now() - 3600_000), // 1 jam lalu
      endAt: new Date(Date.now() + 7200_000), // 2 jam mendatang
      activeCandidateCount: 2,
    });
    createdElectionIds.push(fixture.election.id);
  });

  afterAll(async () => {
    await cleanupTestArtifacts({
      baseline,
      electionIds: createdElectionIds,
    });
  });

  it("menolak pengaturan jika status 'open' namun endAt disetel di masa lalu", async () => {
    const req = createAdminNextRequest(
      "http://localhost:3000/api/admin/settings",
      adminCookie,
      {
        method: "PUT",
        body: JSON.stringify({
          electionId: fixture.election.id,
          status: "open",
          endAt: new Date(Date.now() - 3600_000).toISOString(), // 1 jam lalu
        }),
      }
    );

    const res = await settingsPut(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: { code: string; message: string; details?: Record<string, unknown> };
    };
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(json.error)).toContain(
      "Waktu selesai pemilihan harus berada di masa depan"
    );
  });

  it("mencatat audit log 'schedule_adjusted' saat jadwal jam diubah di hari-H saat status 'open'", async () => {
    const newEndAt = new Date(Date.now() + 14400_000).toISOString(); // 4 jam mendatang

    const req = createAdminNextRequest(
      "http://localhost:3000/api/admin/settings",
      adminCookie,
      {
        method: "PUT",
        body: JSON.stringify({
          electionId: fixture.election.id,
          status: "open",
          endAt: newEndAt,
        }),
      }
    );

    const res = await settingsPut(req);
    expect(res.status).toBe(200);
  });

  it("proteksi bertingkat: menolak pengubahan nomor urut jika kandidat sudah memiliki suara (> 0)", async () => {
    const cand1 = fixture.candidateActive;
    await createIsolatedVoter({
      electionId: fixture.election.id,
      groupId: fixture.group.id,
      voterIdentity: "999901",
      name: "Pemilih Uji Safeguard",
    });

    // Simulasikan 1 suara masuk untuk cand1
    await db.insert(votes).values({
      electionId: fixture.election.id,
      candidateId: cand1.id,
    });

    const req = createAdminNextRequest(
      `http://localhost:3000/api/admin/candidates/${cand1.id}`,
      adminCookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          candidateNumber: 99, // mencoba ganti nomor urut
        }),
      }
    );

    const res = await candidatePatch(req, {
      params: Promise.resolve({ id: cand1.id }),
    });

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("CONFLICT");
    expect(json.error.message).toContain("Nomor urut tidak dapat diubah");
  });

  it("proteksi bertingkat: menolak penonaktifan kandidat jika sudah memiliki suara (> 0)", async () => {
    const cand1 = fixture.candidateActive;

    const req = createAdminNextRequest(
      `http://localhost:3000/api/admin/candidates/${cand1.id}`,
      adminCookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          isActive: false, // mencoba menonaktifkan
        }),
      }
    );

    const res = await candidatePatch(req, {
      params: Promise.resolve({ id: cand1.id }),
    });

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("CONFLICT");
    expect(json.error.message).toContain("Kandidat tidak dapat dinonaktifkan");
  });

  it("proteksi bertingkat: mengizinkan perbaikan typo profil (nama, visi, kelas) meskipun sudah ada suara", async () => {
    const cand1 = fixture.candidateActive;

    const req = createAdminNextRequest(
      `http://localhost:3000/api/admin/candidates/${cand1.id}`,
      adminCookie,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Raka Aditya Pratama, S.Pd (Revisi Typo)",
          classOrUnit: "XII MIPA 1 (Unggulan)",
          vision: "Visi telah disempurnakan tanpa mengubah nomor urut.",
        }),
      }
    );

    const res = await candidatePatch(req, {
      params: Promise.resolve({ id: cand1.id }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { name: string } };
    expect(json.success).toBe(true);
    expect(json.data.name).toBe("Raka Aditya Pratama, S.Pd (Revisi Typo)");
  });

  it("sinkronisasi cerdas: jika waktu pemilihan (endAt) telah lewat, kandidat dengan 0 suara dapat dihapus tanpa terblokir pesan 'sedang berlangsung'", async () => {
    const cand2 = fixture.activeCandidates[1]; // belum ada suara (0 suara)

    // Ubah jadwal endAt fixture ke masa lalu
    await db
      .update(elections)
      .set({
        endAt: new Date(Date.now() - 3600_000), // 1 jam lalu
      })
      .where(eq(elections.id, fixture.election.id));

    const req = createAdminNextRequest(
      `http://localhost:3000/api/admin/candidates/${cand2.id}`,
      adminCookie,
      {
        method: "DELETE",
      }
    );

    const res = await candidateDelete(req, {
      params: Promise.resolve({ id: cand2.id }),
    });

    // Harus berhasil dihapus (200) karena now > endAt dan 0 suara!
    expect(res.status).toBe(200);
  });
});
