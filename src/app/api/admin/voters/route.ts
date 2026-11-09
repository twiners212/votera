import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { voters, voterGroups, elections, gradeLevels, majors } from "@/db/schema";
import { eq, and, sql, desc, asc, ilike, or } from "drizzle-orm";
import { auth } from "@/lib/auth/admin-auth";
import { insertAuditLog } from "@/lib/audit";
import {
  generateVoterToken,
  hashVoterToken,
  encryptVoterToken,
  decryptVoterToken,
} from "@/lib/crypto/token";

const createVoterSchema = z.object({
  voterIdentity: z.string().trim().min(1, "Nomor identitas (NIS) wajib diisi"),
  name: z.string().trim().min(2, "Nama pemilih minimal 2 karakter"),
  groupId: z.string().uuid("Pilih rombel yang valid"),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all";
    const groupId = searchParams.get("groupId") || "all";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "25")));
    const offset = (page - 1) * limit;

    // Filters
    const conditions = [eq(voters.electionId, activeElection.id)];

    if (search) {
      conditions.push(
        or(
          ilike(voters.name, `%${search}%`),
          ilike(voters.voterIdentity, `%${search}%`)
        )!
      );
    }

    if (groupId !== "all") {
      conditions.push(eq(voters.groupId, groupId));
    }

    if (status === "voted") {
      conditions.push(eq(voters.hasVoted, true));
    } else if (status === "not_voted") {
      conditions.push(eq(voters.hasVoted, false));
    } else if (status === "locked") {
      conditions.push(sql`${voters.lockedUntil} IS NOT NULL AND ${voters.lockedUntil} > now()`);
    }

    // Query Total KPI Stats
    const [kpiStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        voted: sql<number>`count(*) filter (where ${voters.hasVoted} = true)::int`,
        notVoted: sql<number>`count(*) filter (where ${voters.hasVoted} = false)::int`,
      })
      .from(voters)
      .where(eq(voters.electionId, activeElection.id));

    const totalVoters = kpiStats?.total || 0;
    const votedCount = kpiStats?.voted || 0;
    const notVotedCount = kpiStats?.notVoted || 0;
    const turnoutPercent =
      totalVoters > 0 ? Number(((votedCount / totalVoters) * 100).toFixed(1)) : 0;

    // Count filtered rows for pagination
    const [filterCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(voters)
      .where(and(...conditions));

    const totalFiltered = filterCount?.count || 0;
    const totalPages = Math.ceil(totalFiltered / limit);

    // Query Paginated Rows
    const rows = await db
      .select({
        id: voters.id,
        voterIdentity: voters.voterIdentity,
        name: voters.name,
        groupId: voters.groupId,
        groupName: voterGroups.name,
        voterStatus: voters.voterStatus,
        hasVoted: voters.hasVoted,
        votedAt: voters.votedAt,
        tokenEncrypted: voters.tokenEncrypted,
        lockedUntil: voters.lockedUntil,
        failedLoginAttempts: voters.failedLoginAttempts,
        createdAt: voters.createdAt,
      })
      .from(voters)
      .innerJoin(voterGroups, eq(voters.groupId, voterGroups.id))
      .where(and(...conditions))
      .orderBy(asc(voters.voterIdentity))
      .limit(limit)
      .offset(offset);

    // Decrypt tokens in-memory for unvoted voters on this page
    const formattedRows = rows.map((r) => {
      let rawToken: string | null = null;
      if (!r.hasVoted) {
        try {
          rawToken = decryptVoterToken(r.tokenEncrypted);
        } catch {
          rawToken = "ERROR";
        }
      }

      return {
        id: r.id,
        voterIdentity: r.voterIdentity,
        name: r.name,
        groupId: r.groupId,
        groupName: r.groupName,
        voterStatus: r.voterStatus,
        hasVoted: r.hasVoted,
        votedAt: r.votedAt,
        token: rawToken,
        isLocked: !!(r.lockedUntil && new Date(r.lockedUntil) > new Date()),
        createdAt: r.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedRows,
      stats: {
        total: totalVoters,
        voted: votedCount,
        notVoted: notVotedCount,
        turnoutPercent,
      },
      pagination: {
        page,
        limit,
        totalItems: totalFiltered,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[Voters GET Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal memuat daftar pemilih." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Sesi tidak valid." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = createVoterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "VALIDATION_ERROR", message: result.error.errors[0]?.message },
        { status: 400 }
      );
    }

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

    const { voterIdentity, name, groupId } = result.data;
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "::1";

    // Cek duplikasi NIS di pemilihan aktif
    const [existing] = await db
      .select()
      .from(voters)
      .where(
        and(
          eq(voters.electionId, activeElection.id),
          eq(voters.voterIdentity, voterIdentity)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "DUPLICATE_NIS",
          message: `Pemilih dengan nomor identitas (NIS) '${voterIdentity}' sudah terdaftar (${existing.name}).`,
        },
        { status: 409 }
      );
    }

    // Generate token 8 karakter non-ambigu
    const rawToken = generateVoterToken();
    const tokenHash = hashVoterToken(rawToken);
    const tokenEncrypted = encryptVoterToken(rawToken);

    const [inserted] = await db
      .insert(voters)
      .values({
        electionId: activeElection.id,
        groupId,
        voterIdentity,
        name,
        tokenHash,
        tokenEncrypted,
        hasVoted: false,
        voterStatus: "not_voted",
        failedLoginAttempts: 0,
      })
      .returning();

    await insertAuditLog({
      electionId: activeElection.id,
      actorType: "admin",
      actorId: session.user.id,
      actorName: session.user.name,
      actorIdentity: session.user.email,
      action: "voter_created",
      actionTitle: "Pemilih ditambahkan",
      description: `Menambahkan pemilih NIS ${voterIdentity} (${name})`,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: `Pemilih '${name}' berhasil didaftarkan.`,
      data: {
        id: inserted.id,
        voterIdentity: inserted.voterIdentity,
        name: inserted.name,
        token: rawToken,
      },
    });
  } catch (error) {
    console.error("[Voters POST Error]:", error);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "Gagal mendaftarkan pemilih." },
      { status: 500 }
    );
  }
}
