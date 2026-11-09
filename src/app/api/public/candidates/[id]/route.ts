import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { candidates, elections } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [activeElection] = await db
      .select()
      .from(elections)
      .where(eq(elections.isActive, true))
      .limit(1);

    if (!activeElection) {
      return NextResponse.json(
        { success: false, error: "NO_ACTIVE_ELECTION", message: "Tidak ada pemilihan aktif." },
        { status: 404 }
      );
    }

    const isNumeric = /^\d+$/.test(id);

    const [candidate] = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.electionId, activeElection.id),
          isNumeric
            ? eq(candidates.candidateNumber, parseInt(id))
            : eq(candidates.id, id)
        )
      )
      .limit(1);

    if (!candidate) {
      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: "Kandidat tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: candidate,
    });
  } catch (error) {
    console.error("[Public Candidate Detail Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memuat profil kandidat." },
      { status: 500 }
    );
  }
}
