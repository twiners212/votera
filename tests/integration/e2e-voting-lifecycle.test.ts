import { describe, it, expect, beforeAll } from "vitest";
import { db, dbPool } from "@/db";
import {
  elections,
  candidates,
  voters,
  voterGroups,
  votes,
  auditLogs,
  users,
} from "@/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import {
  generateVoterToken,
  hashVoterToken,
  encryptVoterToken,
  decryptVoterToken,
} from "@/lib/crypto/token";
import { castVoteTransaction } from "@/lib/voting/cast-vote";
import { generateOfficialBeritaAcaraPdf } from "@/lib/reports/export-pdf";
import { generateOfficialElectionExcel } from "@/lib/reports/export-excel";

describe("Phase 11: End-to-End Election & Voting Lifecycle Integration Test", () => {
  let testElectionId: string;
  let testGroupId: string;
  let testCandidate1Id: string;
  let testCandidate2Id: string;
  let testVoterId: string;
  let testVoterIdentity: string;
  let testVoterTokenPlain: string;

  beforeAll(async () => {
    // 1. Ambil pemilihan aktif
    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    expect(activeElection).toBeDefined();
    testElectionId = activeElection.id;

    // 2. Ambil grup rombel
    const [group] = await db
      .select()
      .from(voterGroups)
      .where(eq(voterGroups.electionId, testElectionId))
      .limit(1);

    expect(group).toBeDefined();
    testGroupId = group.id;

    // 3. Ambil 2 kandidat aktif
    const activeCandidates = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, testElectionId),
          eq(candidates.isActive, true)
        )
      )
      .limit(2);

    expect(activeCandidates.length).toBeGreaterThanOrEqual(2);
    testCandidate1Id = activeCandidates[0].id;
    testCandidate2Id = activeCandidates[1].id;

    // 4. Buat 1 pemilih uji baru khusus untuk pengujian E2E ini
    testVoterIdentity = `E2E_${Date.now()}`;
    testVoterTokenPlain = generateVoterToken();
    const tokenHash = hashVoterToken(testVoterTokenPlain);
    const tokenEncrypted = encryptVoterToken(testVoterTokenPlain);

    const [createdVoter] = await db
      .insert(voters)
      .values({
        electionId: testElectionId,
        groupId: testGroupId,
        voterIdentity: testVoterIdentity,
        name: "Siswa Pengujian E2E",
        tokenHash,
        tokenEncrypted,
        hasVoted: false,
      })
      .returning();

    testVoterId = createdVoter.id;
  });

  it("Langkah 1: Verifikasi kesiapan pemilihan (Readiness)", async () => {
    const candidateList = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, testElectionId),
          eq(candidates.isActive, true)
        )
      );

    const [voterCount] = await db
      .select({ count: count() })
      .from(voters)
      .where(eq(voters.electionId, testElectionId));

    expect(candidateList.length).toBeGreaterThanOrEqual(2);
    expect(Number(voterCount.count)).toBeGreaterThan(0);
  });

  it("Langkah 2: Verifikasi dekripsi token pemilih oleh panitia (Token Handling)", () => {
    const voterTokenPlain = testVoterTokenPlain;
    const encrypted = encryptVoterToken(voterTokenPlain);
    const decrypted = decryptVoterToken(encrypted);

    expect(decrypted).toBe(voterTokenPlain);
  });

  it("Langkah 3: Pemilih memberikan suara secara atomik dan anonim", async () => {
    // Ambil jumlah suara kandidat 1 sebelum voting
    const [votesBefore] = await db
      .select({ count: count() })
      .from(votes)
      .where(eq(votes.candidateId, testCandidate1Id));
    const countBefore = Number(votesBefore.count);

    // Jalankan transaksi pemungutan suara atomik
    const voteResult = await castVoteTransaction({
      voterId: testVoterId,
      candidateId: testCandidate1Id,
      ipAddress: "127.0.0.1",
    });

    expect(voteResult.success).toBe(true);
    expect(voteResult.votedAt).toBeDefined();

    // Verifikasi status pemilih di database telah berubah menjadi has_voted = true
    const [updatedVoter] = await db
      .select()
      .from(voters)
      .where(eq(voters.id, testVoterId));
    expect(updatedVoter.hasVoted).toBe(true);
    expect(updatedVoter.votedAt).not.toBeNull();

    // Verifikasi penambahan suara kandidat di tabel votes
    const [votesAfter] = await db
      .select({ count: count() })
      .from(votes)
      .where(eq(votes.candidateId, testCandidate1Id));
    const countAfter = Number(votesAfter.count);
    expect(countAfter).toBe(countBefore + 1);

    // Verifikasi bahwa tabel votes SAMA SEKALI TIDAK memiliki voter_id
    const [insertedVote] = await db
      .select()
      .from(votes)
      .where(eq(votes.candidateId, testCandidate1Id))
      .orderBy(desc(votes.createdAt))
      .limit(1);
    expect((insertedVote as any).voterId).toBeUndefined();
    expect((insertedVote as any).voter_id).toBeUndefined();
  });

  it("Langkah 4: Pencegahan pemungutan suara ganda (Double-Voting Immunity)", async () => {
    // Mencoba memberikan suara untuk kedua kalinya dengan pemilih yang sama
    await expect(
      castVoteTransaction({
        voterId: testVoterId,
        candidateId: testCandidate2Id,
        ipAddress: "127.0.0.1",
      })
    ).rejects.toThrow("ALREADY_VOTED");
  });

  it("Langkah 5: Verifikasi audit log tercatat tanpa membocorkan pilihan kandidat", async () => {
    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.electionId, testElectionId),
          eq(auditLogs.actorIdentity, `NIS ${testVoterIdentity}`),
          eq(auditLogs.action, "vote_cast")
        )
      );

    expect(logs.length).toBeGreaterThanOrEqual(1);
    const voteLog = logs[0];

    // Deskripsi harus anonim dan tidak mencantumkan nama kandidat atau candidateId
    expect(voteLog.description).toBe("Pemilih telah memberikan suara");
    expect(voteLog.description).not.toContain(testCandidate1Id);
    expect(voteLog.description).not.toContain("Raka");
  });

  it("Langkah 6: Menghasilkan dokumen laporan resmi (Berita Acara PDF & Excel)", () => {
    const reportData = {
      election: {
        title: "PILKETOS 2026 E2E",
        organizationName: "SMA Bojong Gede",
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
      },
      kpis: {
        totalVoters: 77,
        totalVotes: 1,
        unvotedCount: 76,
        turnoutPercentage: 1.3,
      },
      candidates: [
        {
          candidateNumber: 1,
          name: "Kandidat 1",
          classOrUnit: "XI IPA",
          voteCount: 1,
          percentage: 100,
          isLeader: true,
        },
        {
          candidateNumber: 2,
          name: "Kandidat 2",
          classOrUnit: "XI IPS",
          voteCount: 0,
          percentage: 0,
          isLeader: false,
        },
      ],
      classTurnout: [
        {
          name: "Rombel 1",
          total: 10,
          voted: 1,
          percentage: 10,
        },
      ],
    };

    const pdf = generateOfficialBeritaAcaraPdf(reportData);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const excel = generateOfficialElectionExcel(reportData);
    expect(excel.byteLength).toBeGreaterThan(500);
  });
});
