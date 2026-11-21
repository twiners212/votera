import { NextRequest } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import {
  accounts,
  candidates,
  db,
  dbPool,
  elections,
  majors,
  voterGroups,
  voterSessions,
  voters,
  votes,
} from "@/db";
import { requireAdminApiSession } from "@/lib/auth/admin-guard";
import {
  extractClientIp,
  formatErrorResponse,
  formatSuccessResponse,
  formatZodErrorResponse,
} from "@/lib/admin/api-response";
import { resolveTargetElection } from "@/lib/admin/resolve-election";
import { revalidateElectionCaches } from "@/lib/admin/cached-aggregations";
import { resetElectionSchema } from "@/lib/validations/election";
import { insertAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireAdminApiSession([
      "super_admin",
    ]);
    if (errorResponse) {
      return errorResponse;
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return formatErrorResponse(
        "VALIDATION_ERROR",
        "Payload JSON tidak valid.",
        400
      );
    }

    const parsed = resetElectionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return formatZodErrorResponse(parsed.error);
    }

    // Sudo Mode Password Confirmation: verifikasi password Super Admin
    const [adminAccount] = await db
      .select({ password: accounts.password })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, session.user.id),
          isNotNull(accounts.password)
        )
      )
      .limit(1);

    if (!adminAccount?.password) {
      return formatErrorResponse(
        "INVALID_CREDENTIALS",
        "Password Super Admin salah. Tindakan dibatalkan.",
        401
      );
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await verifyPassword({
        hash: adminAccount.password,
        password: parsed.data.password,
      });
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      return formatErrorResponse(
        "INVALID_CREDENTIALS",
        "Password Super Admin salah. Tindakan dibatalkan.",
        401
      );
    }

    const election = await resolveTargetElection(parsed.data.electionId);
    if (!election) {
      return formatErrorResponse(
        "NOT_FOUND",
        "Data pemilihan tidak ditemukan.",
        404
      );
    }

    // Pra-reset check: Tolak jika pemilihan sedang aktif / open
    if (election.status === "open" || (election.status as string) === "active") {
      return formatErrorResponse(
        "BAD_REQUEST",
        "Pemilihan sedang aktif. Ubah status ke paused atau closed terlebih dahulu.",
        400
      );
    }

    const deletedEntities: string[] = ["votes", "voter_sessions", "voters"];
    if (parsed.data.deleteMasterData) {
      deletedEntities.push("voter_groups", "majors");
    }
    if (parsed.data.deleteCandidates) {
      deletedEntities.push("candidates");
    }

    const cleanUsername = session.user.username
      ? session.user.username.replace(/^@+/, "")
      : null;
    const adminIdentifier = cleanUsername
      ? `@${cleanUsername}`
      : session.user.email;
    const description = `Super admin ${adminIdentifier} mereset data pemilihan: ${deletedEntities.join(", ")}. Status pemilihan dikembalikan ke draft.`;

    // Transaksi atomik: hapus data anak terlebih dahulu sesuai relasi FK
    await dbPool.transaction(async (tx) => {
      // 1. Hapus votes untuk electionId
      await tx.delete(votes).where(eq(votes.electionId, election.id));

      // 2. Hapus voterSessions dan voters untuk electionId
      await tx
        .delete(voterSessions)
        .where(eq(voterSessions.electionId, election.id));
      await tx.delete(voters).where(eq(voters.electionId, election.id));

      // 3. Jika deleteMasterData: Hapus voterGroups lalu majors
      if (parsed.data.deleteMasterData) {
        await tx
          .delete(voterGroups)
          .where(eq(voterGroups.electionId, election.id));
        await tx.delete(majors).where(eq(majors.electionId, election.id));
      }

      // 4. Jika deleteCandidates: Hapus candidates
      if (parsed.data.deleteCandidates) {
        await tx
          .delete(candidates)
          .where(eq(candidates.electionId, election.id));
      }

      // 5. Ubah status pemilihan kembali ke "draft"
      await tx
        .update(elections)
        .set({
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(elections.id, election.id));

      // 6. Catat entri audit_logs di dalam transaksi
      await insertAuditLog({
        electionId: election.id,
        actorType: "admin",
        actorId: session.user.id,
        actorName: session.user.name,
        actorIdentity: adminIdentifier,
        action: "election_data_reset",
        actionTitle: "Data Pemilihan Direset",
        description,
        ipAddress: extractClientIp(request),
        tx,
      });
    });

    // Invalidate server-side cache
    revalidateElectionCaches(election.id);

    return formatSuccessResponse({
      reset: true,
      electionId: election.id,
      status: "draft",
      deletedEntities,
      message:
        "Data pemilihan berhasil direset. Status pemilihan dikembalikan ke draft.",
    });
  } catch (error) {
    console.error("Election reset route error:", error);
    return formatErrorResponse(
      "INTERNAL_SERVER_ERROR",
      "Terjadi kesalahan pada server saat mereset data pemilihan.",
      500
    );
  }
}
