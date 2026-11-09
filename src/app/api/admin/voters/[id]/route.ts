import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { voters, voterSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";

const updateVoterSchema = z.object({
  name: z.string().trim().min(2).optional(),
  voterIdentity: z.string().trim().min(1).optional(),
  groupId: z.string().uuid().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const result = updateVoterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
        { status: 400 }
      );
    }

    const [voter] = await db.select().from(voters).where(eq(voters.id, id)).limit(1);
    if (!voter) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Pemilih tidak ditemukan." },
        { status: 404 }
      );
    }

    const { name, voterIdentity, groupId } = result.data;

    // Invariant: DILARANG mengubah identitas pemilih jika sudah memilih
    if (voter.hasVoted && voterIdentity && voterIdentity !== voter.voterIdentity) {
      return NextResponse.json(
        {
          success: false,
          error: "VOTER_IMMUTABLE",
          message: "Nomor identitas pemilih yang sudah menggunakan hak suara tidak dapat diubah.",
        },
        { status: 409 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (voterIdentity) updates.voterIdentity = voterIdentity;
    if (groupId) updates.groupId = groupId;

    const [updated] = await db.update(voters).set(updates).where(eq(voters.id, id)).returning();

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    await insertAuditLog({
      electionId: voter.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "voter_updated",
      actionTitle: "Data pemilih diperbarui",
      description: `Memperbarui pemilih NIS ${updated.voterIdentity} (${updated.name})`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: "Data pemilih berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    console.error("[Voter PATCH Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memperbarui data pemilih." },
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
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const [voter] = await db.select().from(voters).where(eq(voters.id, id)).limit(1);
    if (!voter) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Pemilih tidak ditemukan." },
        { status: 404 }
      );
    }

    // Invariant: DILARANG menghapus pemilih yang sudah memilih
    if (voter.hasVoted) {
      return NextResponse.json(
        {
          success: false,
          error: "VOTER_IMMUTABLE",
          message: "Pemilih yang sudah menggunakan hak suara TIDAK DAPAT dihapus demi integritas data dan audit log pemilihan.",
        },
        { status: 409 }
      );
    }

    // Hapus sesi aktif pemilih jika ada
    await db.delete(voterSessions).where(eq(voterSessions.voterId, id));

    const [deleted] = await db.delete(voters).where(eq(voters.id, id)).returning();

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";
    await insertAuditLog({
      electionId: deleted.electionId,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "voter_deleted",
      actionTitle: "Pemilih dihapus",
      description: `Menghapus pemilih NIS ${deleted.voterIdentity} (${deleted.name})`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Pemilih '${deleted.name}' berhasil dihapus dari DPT.`,
    });
  } catch (error) {
    console.error("[Voter DELETE Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal menghapus pemilih." },
      { status: 500 }
    );
  }
}
