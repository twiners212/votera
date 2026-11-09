import { describe, it, expect, beforeAll } from "vitest";
import { db, dbPool } from "@/db";
import { voters, elections, candidates, votes, voterSessions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { hashVoterToken, encryptVoterToken } from "@/lib/crypto/token";
import { castVoteTransaction } from "@/lib/voting/cast-vote";
import { createVoterSession } from "@/lib/auth/voter-session";

describe("Phase 8: Atomic Voting & Ballot Anonymity Integration Tests", () => {
  let testElectionId: string;
  let testCandidateId: string;
  const testNis = "8888001";
  let testVoterId: string;

  beforeAll(async () => {
    // 1. Ambil pemilihan aktif
    const [election] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    expect(election).toBeDefined();
    testElectionId = election.id;

    // 2. Ambil kandidat aktif pertama
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(and(eq(candidates.electionId, testElectionId), eq(candidates.isActive, true)))
      .limit(1);

    expect(candidate).toBeDefined();
    testCandidateId = candidate.id;

    // 3. Bersihkan pemilih uji lama jika ada
    await db.delete(voters).where(eq(voters.voterIdentity, testNis));

    // 4. Ambil grup pertama
    const [group] = await db
      .select()
      .from(voters)
      .where(eq(voters.electionId, testElectionId))
      .limit(1);

    // 5. Buat pemilih uji baru
    const [created] = await db
      .insert(voters)
      .values({
        electionId: testElectionId,
        groupId: group.groupId,
        voterIdentity: testNis,
        name: "Pemilih Uji Voting Atomik",
        tokenHash: hashVoterToken("VOTETEST"),
        tokenEncrypted: encryptVoterToken("VOTETEST"),
        hasVoted: false,
        voterStatus: "not_voted",
        failedLoginAttempts: 0,
      })
      .returning();

    testVoterId = created.id;
  });

  it("harus berhasil mengirim suara secara atomik dan menghapus sesi pemilih", async () => {
    // Buat sesi untuk pemilih
    const { token } = await createVoterSession({
      voterId: testVoterId,
      electionId: testElectionId,
    });

    const voteCountBefore = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(votes)
      .where(eq(votes.candidateId, testCandidateId));

    const initialVotes = voteCountBefore[0]?.count || 0;

    // Eksekusi transaksi voting
    const result = await castVoteTransaction({
      voterId: testVoterId,
      candidateId: testCandidateId,
      ipAddress: "127.0.0.1",
    });

    expect(result.success).toBe(true);
    expect(result.electionId).toBe(testElectionId);

    // Verifikasi status pemilih di database
    const [voterAfter] = await db.select().from(voters).where(eq(voters.id, testVoterId));
    expect(voterAfter.hasVoted).toBe(true);
    expect(voterAfter.voterStatus).toBe("voted");
    expect(voterAfter.votedAt).not.toBeNull();

    // Verifikasi suara tercatat di tabel votes
    const voteCountAfter = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(votes)
      .where(eq(votes.candidateId, testCandidateId));

    expect(voteCountAfter[0]?.count).toBe(initialVotes + 1);

    // Verifikasi sesi pemilih telah terhapus
    const sessions = await db
      .select()
      .from(voterSessions)
      .where(eq(voterSessions.voterId, testVoterId));
    expect(sessions).toHaveLength(0);
  });

  it("harus menolak pemungutan suara ganda oleh pemilih yang sama", async () => {
    // Coba memilih lagi dengan pemilih yang sudah berstatus hasVoted = true
    await expect(
      castVoteTransaction({
        voterId: testVoterId,
        candidateId: testCandidateId,
        ipAddress: "127.0.0.1",
      })
    ).rejects.toThrow("ALREADY_VOTED");
  });

  it("harus menangani kondisi balapan konkuren (race condition) sehingga hanya 1 suara yang berhasil", async () => {
    // Buat pemilih khusus untuk pengujian race condition
    const raceNis = "8888002";
    await db.delete(voters).where(eq(voters.voterIdentity, raceNis));

    const [firstVoter] = await db.select().from(voters).limit(1);

    const [raceVoter] = await db
      .insert(voters)
      .values({
        electionId: testElectionId,
        groupId: firstVoter.groupId,
        voterIdentity: raceNis,
        name: "Pemilih Uji Race Condition",
        tokenHash: hashVoterToken("RACETEST"),
        tokenEncrypted: encryptVoterToken("RACETEST"),
        hasVoted: false,
        voterStatus: "not_voted",
        failedLoginAttempts: 0,
      })
      .returning();

    const votesBefore = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(votes)
      .where(eq(votes.candidateId, testCandidateId));

    const countBefore = votesBefore[0]?.count || 0;

    // Luncurkan 2 request transaksi voting secara bersamaan (Promise.all)
    const results = await Promise.allSettled([
      castVoteTransaction({
        voterId: raceVoter.id,
        candidateId: testCandidateId,
        ipAddress: "127.0.0.1",
      }),
      castVoteTransaction({
        voterId: raceVoter.id,
        candidateId: testCandidateId,
        ipAddress: "127.0.0.1",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Persis 1 transaksi berhasil dan 1 transaksi ditolak
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Error penolakan adalah ALREADY_VOTED
    if (rejected[0].status === "rejected") {
      expect(rejected[0].reason.message).toBe("ALREADY_VOTED");
    }

    // Suara hanya bertambah tepat 1
    const votesAfter = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(votes)
      .where(eq(votes.candidateId, testCandidateId));

    expect(votesAfter[0]?.count).toBe(countBefore + 1);
  });
});
