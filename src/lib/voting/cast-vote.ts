import { and, eq, sql } from "drizzle-orm";
import { candidates, dbPool, elections, voters, votes } from "@/db";
import { insertAuditLog } from "@/lib/audit";

export class VotingError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "VotingError";
  }
}

export interface CastVoteParams {
  electionId: string;
  voterId: string;
  candidateId: string;
  ipAddress: string;
}

export interface CastVoteResult {
  success: true;
  votedAt: string;
}

export async function castVoteTransaction(
  params: CastVoteParams
): Promise<CastVoteResult> {
  const { electionId, voterId, candidateId, ipAddress } = params;

  return dbPool.transaction(async (tx) => {
    // 1. Validasi jadwal buka-tutup pemilihan langsung memakai jam server PostgreSQL (now())
    const [election] = await tx
      .select({
        id: elections.id,
        status: elections.status,
        isWithinSchedule: sql<boolean>`
          ${elections.status} = 'open'
          AND ${elections.startAt} IS NOT NULL
          AND ${elections.endAt} IS NOT NULL
          AND now() >= ${elections.startAt}
          AND now() <= ${elections.endAt}
        `,
      })
      .from(elections)
      .where(eq(elections.id, electionId));

    if (!election || !election.isWithinSchedule) {
      throw new VotingError(
        "ELECTION_CLOSED",
        "Pemungutan suara sedang tidak dibuka atau di luar jadwal resmi.",
        403
      );
    }

    // 2. Pastikan kandidat terdaftar, aktif, dan milik electionId yang sama
    const [candidate] = await tx
      .select({ id: candidates.id })
      .from(candidates)
      .where(
        and(
          eq(candidates.id, candidateId),
          eq(candidates.electionId, electionId),
          eq(candidates.isActive, true)
        )
      );

    if (!candidate) {
      throw new VotingError(
        "INVALID_CANDIDATE",
        "Kandidat tidak valid atau tidak aktif.",
        400
      );
    }

    // 3. ATOMIC LOCK & UPDATE: mengunci baris pemilih dan menghanguskan tokenEncrypted
    const updatedVoters = await tx
      .update(voters)
      .set({
        hasVoted: true,
        voterStatus: "voted",
        votedAt: sql`now()`,
        tokenEncrypted: "[REDACTED]",
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
        name: voters.name,
        voterIdentity: voters.voterIdentity,
        votedAt: voters.votedAt,
      });

    if (updatedVoters.length === 0) {
      throw new VotingError(
        "ALREADY_VOTED",
        "Suara kamu sudah pernah tercatat sebelumnya. Satu orang hanya memiliki satu suara.",
        409
      );
    }

    const voter = updatedVoters[0];

    // 4. INSERT suara ke tabel `votes` TANPA identitas pemilih & timestamp dibulatkan ke menit
    await tx.insert(votes).values({
      electionId,
      candidateId,
      createdAt: sql`date_trunc('minute', now())`,
    });

    // 5. INSERT jejak audit ke `audit_logs` TANPA candidateId
    await insertAuditLog({
      electionId,
      actorType: "voter",
      actorId: voter.id,
      actorName: voter.name,
      actorIdentity: `NIS ${voter.voterIdentity}`,
      action: "vote_cast",
      actionTitle: "Vote cast",
      description: "Pemilih telah memberikan suara",
      ipAddress: ipAddress?.trim() || "::1",
      tx,
    });

    return {
      success: true,
      votedAt: voter.votedAt
        ? voter.votedAt.toISOString()
        : new Date().toISOString(),
    };
  });
}
