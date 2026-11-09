import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { candidates, votes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";

const updateCandidateSchema = z.object({
  candidateNumber: z.number().int().min(1).optional(),
  name: z.string().trim().min(2).optional(),
  classOrUnit: z.string().trim().min(1).optional(),
  motto: z.string().trim().min(3).optional(),
  vision: z.string().trim().min(5).optional(),
  missions: z.array(z.string().trim().min(1)).optional(),
  programs: z.array(z.string().trim().min(1)).optional(),
  supporters: z.array(z.string().trim().min(1)).optional(),
  photoUrl: z.string().nullable().optional(),
  themeColor: z.enum(["red", "green", "blue", "amber"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat mengubah kandidat." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const result = updateCandidateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      ...result.data,
      updatedAt: sql`now()`,
    };

    const [updated] = await db
      .update(candidates)
      .set(updates)
      .where(eq(candidates.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Kandidat tidak ditemukan." },
        { status: 404 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    await insertAuditLog({
      electionId: updated.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "candidate_updated",
      actionTitle: "Kandidat diperbarui",
      description: `Memperbarui data kandidat #${updated.candidateNumber} (${updated.name})`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Data kandidat #${updated.candidateNumber} berhasil diperbarui.`,
      data: updated,
    });
  } catch (error) {
    console.error("[Candidate PATCH Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memperbarui kandidat." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || session.user.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Hanya Super Admin yang dapat menghapus kandidat." },
        { status: 403 }
      );
    }

    const { id } = await params;

    // 1. Cek apakah kandidat sudah menerima suara
    const [voteCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(votes)
      .where(eq(votes.candidateId, id));

    if (voteCount && voteCount.count > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "CANDIDATE_HAS_VOTES",
          message: `Kandidat tidak dapat dihapus karena sudah memperoleh ${voteCount.count} suara pemilih demi integritas audit. Nonaktifkan status kandidat jika ingin menyembunyikannya dari surat suara.`,
        },
        { status: 409 }
      );
    }

    const [deleted] = await db
      .delete(candidates)
      .where(eq(candidates.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Kandidat tidak ditemukan." },
        { status: 404 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    await insertAuditLog({
      electionId: deleted.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "candidate_deleted",
      actionTitle: "Kandidat dihapus",
      description: `Menghapus kandidat #${deleted.candidateNumber} (${deleted.name})`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Kandidat #${deleted.candidateNumber} (${deleted.name}) berhasil dihapus.`,
    });
  } catch (error) {
    console.error("[Candidate DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal menghapus kandidat." },
      { status: 500 }
    );
  }
}
