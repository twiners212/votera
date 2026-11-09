import { dbPool } from "@/db";
import { voters, votes, voterSessions, elections, candidates } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { insertAuditLog } from "@/lib/audit";

export interface CastVoteParams {
  voterId: string;
  candidateId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CastVoteResult {
  success: boolean;
  electionId: string;
  votedAt: Date;
}

/**
 * Transaksi database atomik untuk pemungutan suara (1-Person-1-Vote).
 * Invarian Keamanan Kritis:
 * 1. WHERE has_voted = false menjamin tidak ada double-voting walaupun ada race condition.
 * 2. Unlinkable Anonymous Ballot: tabel 'votes' TIDAK memiliki voter_id, voter_identity, atau IP.
 * 3. Log aktivitas audit TIDAK PERNAH mencatat candidate_id pilihan pemilih.
 * 4. Sesi aktif pemilih segera dihapus setelah suara tercatat.
 */
export async function castVoteTransaction(params: CastVoteParams): Promise<CastVoteResult> {
  const { voterId, candidateId, ipAddress } = params;

  return await dbPool.transaction(async (tx) => {
    // 1. Verifikasi kandidat yang dipilih
    const [candidate] = await tx
      .select()
      .from(candidates)
      .where(and(eq(candidates.id, candidateId), eq(candidates.isActive, true)))
      .limit(1);

    if (!candidate) {
      throw new Error("CANDIDATE_NOT_FOUND");
    }

    const electionId = candidate.electionId;

    // 2. Verifikasi status dan jadwal pemilihan waktu server
    const [election] = await tx
      .select()
      .from(elections)
      .where(and(eq(elections.id, electionId), eq(elections.isActive, true)))
      .limit(1);

    if (!election) {
      throw new Error("NO_ACTIVE_ELECTION");
    }

    const now = new Date();
    if (
      election.status !== "open" ||
      (election.startAt && now < election.startAt) ||
      (election.endAt && now > election.endAt)
    ) {
      throw new Error("ELECTION_CLOSED");
    }

    // 3. ATOMIC CONDITIONAL UPDATE:
    // Update baris pemilih HANYA JIKA has_voted = false
    const [updatedVoter] = await tx
      .update(voters)
      .set({
        hasVoted: true,
        voterStatus: "voted",
        votedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(voters.id, voterId),
          eq(voters.electionId, electionId),
          eq(voters.hasVoted, false)
        )
      )
      .returning({
        id: voters.id,
        voterIdentity: voters.voterIdentity,
        name: voters.name,
      });

    // Jika 0 baris yang ter-update, berarti pemilih sudah memilih atau terjadi race condition!
    if (!updatedVoter) {
      throw new Error("ALREADY_VOTED");
    }

    // 4. UNLINKABLE ANONYMOUS BALLOT:
    // Masukkan suara ke tabel 'votes' secara terpisah tanpa referensi voter_id
    // Truncate waktu ke menit untuk mitigasi serangan timing correlation
    await tx.insert(votes).values({
      electionId,
      candidateId,
      createdAt: sql`date_trunc('minute', now())`,
    });

    // 5. Invalidate sesi aktif pemilih di tabel voter_sessions
    await tx.delete(voterSessions).where(eq(voterSessions.voterId, voterId));

    // 6. Catat log audit tanpa kandidat pilihan pemilih
    await insertAuditLog({
      electionId,
      actorType: "voter",
      actorId: updatedVoter.id,
      actorName: updatedVoter.name,
      actorIdentity: `NIS ${updatedVoter.voterIdentity}`,
      action: "vote_cast",
      actionTitle: "Suara masuk",
      description: `Pemilih NIS ${updatedVoter.voterIdentity} (${updatedVoter.name}) berhasil menggunakan hak suaranya.`,
      ipAddress,
    });

    return {
      success: true,
      electionId,
      votedAt: now,
    };
  });
}
