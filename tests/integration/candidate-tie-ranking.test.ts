import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db, votes, voters } from "@/db";
import {
  captureBaselineIds,
  cleanupTestArtifacts,
  createIsolatedElectionFixture,
  createAdminNextRequest,
  createIsolatedVoter,
  signInSeedAdmin,
  type BaselineIds,
} from "../helpers/neon-test-harness";
import type { ElectionResultsDTO } from "@/types/votera";

// Mock next/headers so getAdminSession() in admin-guard reads the active test role cookie
let currentMockHeaders = new Headers();
vi.mock("next/headers", () => ({
  headers: async () => currentMockHeaders,
}));

import { GET as resultsGet } from "@/app/api/admin/results/route";

describe("Candidate Tie Ranking & Live Results Consistency (AUD-001)", () => {
  let baseline: BaselineIds;
  let adminCookie = "";
  const createdElectionIds: string[] = [];

  beforeAll(async () => {
    baseline = await captureBaselineIds();
    const adminAuth = await signInSeedAdmin("super_admin");
    adminCookie = adminAuth.cookie;
    currentMockHeaders = new Headers({ cookie: adminCookie });
  });

  afterAll(async () => {
    await cleanupTestArtifacts({
      baseline,
      electionIds: createdElectionIds,
    });
  });

  it("memberikan rank yang sama (rank 1) untuk kandidat dengan perolehan suara imbang di posisi pertama", async () => {
    // Buat fixture dengan 3 kandidat aktif
    const fixture = await createIsolatedElectionFixture({
      isActive: false,
      activeCandidateCount: 3,
    });
    const electionId = fixture.election.id;
    createdElectionIds.push(electionId);

    const cand1 = fixture.activeCandidates[0];
    const cand2 = fixture.activeCandidates[1];
    const cand3 = fixture.activeCandidates[2];

    // Buat 5 pemilih dengan hasVoted: true
    for (let i = 1; i <= 5; i++) {
      await createIsolatedVoter({
        electionId,
        groupId: fixture.group.id,
        voterIdentity: `TIE-VOTER-${i}`,
        hasVoted: true,
        voterStatus: "voted",
      });
    }

    // Simulasikan perolehan suara:
    // cand1: 2 suara
    // cand2: 2 suara (Imbang dengan cand1 di posisi 1)
    // cand3: 1 suara (Posisi 3 dalam standard competition ranking)
    await db.insert(votes).values([
      { electionId, candidateId: cand1.id },
      { electionId, candidateId: cand1.id },
      { electionId, candidateId: cand2.id },
      { electionId, candidateId: cand2.id },
      { electionId, candidateId: cand3.id },
    ]);

    const req = createAdminNextRequest(
      `http://localhost:3000/api/admin/results?electionId=${electionId}`,
      adminCookie
    );

    const res = await resultsGet(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: ElectionResultsDTO;
    };
    expect(json.success).toBe(true);

    const results = json.data;
    expect(results.summary.votesCast).toBe(5);
    expect(results.leadingCandidate).toBeDefined();
    expect(results.leadingCandidate?.isTie).toBe(true);

    const r1 = results.candidates.find((c) => c.id === cand1.id);
    const r2 = results.candidates.find((c) => c.id === cand2.id);
    const r3 = results.candidates.find((c) => c.id === cand3.id);

    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(r3).toBeDefined();

    expect(r1?.voteCount).toBe(2);
    expect(r2?.voteCount).toBe(2);
    expect(r3?.voteCount).toBe(1);

    // Keduanya harus memiliki peringkat 1 karena imbang di puncak
    expect(r1?.rank).toBe(1);
    expect(r2?.rank).toBe(1);
    // Kandidat ketiga harus berperingkat 3 (standard competition 1-1-3)
    expect(r3?.rank).toBe(3);
  });

  it("memberikan rank yang sama untuk kandidat dengan perolehan suara imbang di posisi kedua (1-2-2-4)", async () => {
    const fixture = await createIsolatedElectionFixture({
      isActive: false,
      activeCandidateCount: 4,
    });
    const electionId = fixture.election.id;
    createdElectionIds.push(electionId);

    const [c1, c2, c3, c4] = fixture.activeCandidates;

    for (let i = 1; i <= 9; i++) {
      await createIsolatedVoter({
        electionId,
        groupId: fixture.group.id,
        voterIdentity: `TIE-VOTER-B-${i}`,
        hasVoted: true,
        voterStatus: "voted",
      });
    }

    // c1: 4 suara -> rank 1
    // c2: 2 suara -> rank 2
    // c3: 2 suara -> rank 2 (imbang dengan c2)
    // c4: 1 suara -> rank 4
    await db.insert(votes).values([
      { electionId, candidateId: c1.id },
      { electionId, candidateId: c1.id },
      { electionId, candidateId: c1.id },
      { electionId, candidateId: c1.id },
      { electionId, candidateId: c2.id },
      { electionId, candidateId: c2.id },
      { electionId, candidateId: c3.id },
      { electionId, candidateId: c3.id },
      { electionId, candidateId: c4.id },
    ]);

    const req = createAdminNextRequest(
      `http://localhost:3000/api/admin/results?electionId=${electionId}`,
      adminCookie
    );

    const res = await resultsGet(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      success: boolean;
      data: ElectionResultsDTO;
    };
    expect(json.success).toBe(true);

    const r1 = json.data.candidates.find((c) => c.id === c1.id);
    const r2 = json.data.candidates.find((c) => c.id === c2.id);
    const r3 = json.data.candidates.find((c) => c.id === c3.id);
    const r4 = json.data.candidates.find((c) => c.id === c4.id);

    expect(r1?.rank).toBe(1);
    expect(r2?.rank).toBe(2);
    expect(r3?.rank).toBe(2);
    expect(r4?.rank).toBe(4);
  });
});
