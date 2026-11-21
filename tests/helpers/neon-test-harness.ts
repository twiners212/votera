import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  accounts,
  auditLogs,
  candidates,
  db,
  dbPool,
  electionSettings,
  elections,
  gradeLevels,
  majors,
  sessions,
  users,
  voterGroups,
  voterSessions,
  voters,
  votes,
} from "@/db";
import { auth } from "@/lib/auth/admin-auth";
import {
  VOTER_SESSION_COOKIE,
  createVoterSession,
  hashSessionToken,
  signRawSessionToken,
} from "@/lib/auth/voter-session";
import {
  encryptVoterToken,
  generateVoterToken,
  hashVoterToken,
} from "@/lib/crypto/token";
import type { ElectionStatus, VoterStatus } from "@/types/votera";

export interface BaselineIds {
  auditLogIds: string[];
  userIds: string[];
  sessionIds: string[];
}

export interface IsolatedElectionOptions {
  slug?: string;
  shortName?: string;
  title?: string;
  organizationName?: string;
  status?: ElectionStatus;
  /** Default: false so test fixtures never hijack the active seed election. */
  isActive?: boolean;
  startAt?: Date | null;
  endAt?: Date | null;
  startOffsetMs?: number;
  endOffsetMs?: number;
  isResultPublic?: boolean;
  activeCandidateCount?: number;
  includeInactiveCandidate?: boolean;
}

export interface IsolatedElectionFixture {
  election: typeof elections.$inferSelect;
  settings: typeof electionSettings.$inferSelect;
  gradeLevel: typeof gradeLevels.$inferSelect;
  major: typeof majors.$inferSelect;
  group: typeof voterGroups.$inferSelect;
  candidateActive: typeof candidates.$inferSelect;
  activeCandidates: (typeof candidates.$inferSelect)[];
  candidateInactive: typeof candidates.$inferSelect | null;
}

export interface CreateIsolatedVoterParams {
  electionId: string;
  groupId: string;
  voterIdentity?: string;
  name?: string;
  plainToken?: string;
  hasVoted?: boolean;
  voterStatus?: VoterStatus;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  votedAt?: Date | null;
}

export interface CreatedIsolatedVoter {
  voter: typeof voters.$inferSelect;
  plainToken: string;
}

export interface CleanupTestArtifactsParams {
  baseline?: BaselineIds;
  electionIds?: string[];
  userIds?: string[];
}

export interface AdminCookieResult {
  cookie: string;
  userId: string | null;
}

export interface TestNextRequestOptions {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  ip?: string;
}

let signInCounter = 0;

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
}

function extractCookieHeader(response: Response): string {
  const headersWithGetSetCookie = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headersWithGetSetCookie.getSetCookie === "function") {
    const cookieEntries = headersWithGetSetCookie.getSetCookie();
    if (cookieEntries.length > 0) {
      return cookieEntries
        .map((entry) => entry.split(";")[0]?.trim() ?? "")
        .filter(Boolean)
        .join("; ");
    }
  }

  const rawSetCookie = response.headers.get("set-cookie") ?? "";
  if (!rawSetCookie) {
    return "";
  }
  return rawSetCookie.split(";")[0]?.trim() ?? "";
}

/**
 * Snapshots existing audit log, user, and session IDs before a test suite runs
 * so teardown never touches seed PILKETOS 2026 rows.
 */
export async function captureBaselineIds(): Promise<BaselineIds> {
  const [existingLogs, existingUsers, existingSessions] = await Promise.all([
    db.select({ id: auditLogs.id }).from(auditLogs),
    db.select({ id: users.id }).from(users),
    db.select({ id: sessions.id }).from(sessions),
  ]);

  return {
    auditLogIds: existingLogs.map((row) => row.id),
    userIds: existingUsers.map((row) => row.id),
    sessionIds: existingSessions.map((row) => row.id),
  };
}

/**
 * Creates a self-contained election fixture with unique slug, settings, master
 * data (grade level, major, voter group), and candidates.
 * Defaults `isActive` to `false` so public active-election queries stay intact.
 */
export async function createIsolatedElectionFixture(
  options?: IsolatedElectionOptions
): Promise<IsolatedElectionFixture> {
  const suffix = uniqueSuffix();
  const now = Date.now();
  const startAt =
    options?.startAt !== undefined
      ? options.startAt
      : new Date(now + (options?.startOffsetMs ?? -3_600_000));
  const endAt =
    options?.endAt !== undefined
      ? options.endAt
      : new Date(now + (options?.endOffsetMs ?? 3_600_000));

  const [election] = await db
    .insert(elections)
    .values({
      slug: options?.slug ?? `test-election-${suffix}`,
      shortName: options?.shortName ?? `TEST ${suffix.slice(-6)}`,
      title: options?.title ?? `Pemilihan Uji Coba ${suffix}`,
      organizationName: options?.organizationName ?? "SMK Pengujian Votera",
      status: options?.status ?? "open",
      startAt,
      endAt,
      isActive: options?.isActive ?? false,
    })
    .returning();

  const [settings] = await db
    .insert(electionSettings)
    .values({
      electionId: election.id,
      idLabel: "NISN",
      groupLabel: "Rombel",
      gradeLabel: "Tingkat",
      majorLabel: "Jurusan",
      isResultPublic: options?.isResultPublic ?? false,
    })
    .returning();

  const [gradeLevel] = await db
    .insert(gradeLevels)
    .values({
      electionId: election.id,
      name: `Tingkat ${suffix}`,
      sortOrder: 1,
    })
    .returning();

  const [major] = await db
    .insert(majors)
    .values({
      electionId: election.id,
      name: `Jurusan ${suffix}`,
      code: `JUR-${suffix.slice(-6).toUpperCase()}`,
      sortOrder: 1,
    })
    .returning();

  const [group] = await db
    .insert(voterGroups)
    .values({
      electionId: election.id,
      gradeLevelId: gradeLevel.id,
      majorId: major.id,
      name: `Rombel ${suffix}`,
      sortOrder: 1,
    })
    .returning();

  const activeCount = Math.max(1, options?.activeCandidateCount ?? 2);
  const activeCandidateInputs = Array.from({ length: activeCount }, (_, idx) => {
    const num = idx + 1;
    const themes = ["red", "blue", "green", "amber"] as const;
    return {
      electionId: election.id,
      candidateNumber: num,
      name: `Kandidat Uji ${num}`,
      classOrUnit: `XI-IPA-${num}`,
      motto: `Motto Kandidat ${num}`,
      vision: `Visi lengkap untuk kandidat uji nomor urut ${num}.`,
      missions: [`Misi ${num}.1`, `Misi ${num}.2`],
      programs: [`Program Kerja ${num}.1`],
      supporters: [`Pendukung ${num}.1`],
      themeColor: themes[idx % themes.length],
      isActive: true,
    };
  });

  const activeCandidates = await db
    .insert(candidates)
    .values(activeCandidateInputs)
    .returning();

  let candidateInactive: typeof candidates.$inferSelect | null = null;
  if (options?.includeInactiveCandidate ?? true) {
    const [inactive] = await db
      .insert(candidates)
      .values({
        electionId: election.id,
        candidateNumber: activeCount + 1,
        name: "Kandidat Nonaktif Uji",
        classOrUnit: "XI-IPS-1",
        motto: "Motto Nonaktif",
        vision: "Visi kandidat nonaktif untuk pengujian integrasi.",
        missions: ["Misi Nonaktif 1"],
        programs: [],
        supporters: [],
        themeColor: "amber",
        isActive: false,
      })
      .returning();
    candidateInactive = inactive;
  }

  return {
    election,
    settings,
    gradeLevel,
    major,
    group,
    candidateActive: activeCandidates[0],
    activeCandidates,
    candidateInactive,
  };
}

/**
 * Inserts an isolated voter with a real HMAC-hashed and AES-256-GCM encrypted
 * 8-character token (or "[REDACTED]" when `hasVoted` is true).
 */
export async function createIsolatedVoter(
  params: CreateIsolatedVoterParams
): Promise<CreatedIsolatedVoter> {
  const plainToken = params.plainToken ?? generateVoterToken(8);
  const hasVoted = params.hasVoted ?? false;
  const voterIdentity =
    params.voterIdentity ?? `NIS-${crypto.randomBytes(4).toString("hex")}`;

  const [voter] = await db
    .insert(voters)
    .values({
      electionId: params.electionId,
      groupId: params.groupId,
      voterIdentity,
      name: params.name ?? "Pemilih Uji",
      tokenHash: hashVoterToken(plainToken),
      tokenEncrypted: hasVoted ? "[REDACTED]" : encryptVoterToken(plainToken),
      voterStatus: params.voterStatus ?? (hasVoted ? "voted" : "not_voted"),
      hasVoted,
      failedLoginAttempts: params.failedLoginAttempts ?? 0,
      lockedUntil: params.lockedUntil ?? null,
      lastLoginAt: params.lastLoginAt ?? null,
      votedAt: params.votedAt !== undefined ? params.votedAt : hasVoted ? new Date() : null,
    })
    .returning();

  return { voter, plainToken };
}

/**
 * Cleans up local candidate upload directories, test users/sessions, and
 * isolated elections in strict child-first dependency order while temporarily
 * disabling `trg_protect_audit_logs` to remove only non-baseline audit logs.
 */
export async function cleanupTestArtifacts(
  params: CleanupTestArtifactsParams
): Promise<void> {
  const electionIds = Array.from(new Set(params.electionIds ?? [])).filter(Boolean);
  const explicitUserIds = Array.from(new Set(params.userIds ?? [])).filter(Boolean);
  const baseline = params.baseline;

  // 1. Delete local upload directories for test elections
  for (const electionId of electionIds) {
    try {
      const uploadDir = path.join(
        process.cwd(),
        "public",
        "uploads",
        "candidates",
        electionId
      );
      if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      }
    } catch (fsErr) {
      console.warn(
        `Teardown: gagal membersihkan direktori upload untuk ${electionId}:`,
        fsErr
      );
    }
  }

  // 2. Database teardown in one transaction in strict child-first order
  await dbPool.transaction(async (tx) => {
    await tx.execute(
      sql`ALTER TABLE audit_logs DISABLE TRIGGER trg_protect_audit_logs`
    );

    try {
      if (electionIds.length > 0) {
        await tx.delete(votes).where(inArray(votes.electionId, electionIds));
        await tx
          .delete(voterSessions)
          .where(inArray(voterSessions.electionId, electionIds));
        await tx.delete(voters).where(inArray(voters.electionId, electionIds));
        await tx
          .delete(candidates)
          .where(inArray(candidates.electionId, electionIds));
        await tx
          .delete(voterGroups)
          .where(inArray(voterGroups.electionId, electionIds));
        await tx.delete(majors).where(inArray(majors.electionId, electionIds));
        await tx
          .delete(gradeLevels)
          .where(inArray(gradeLevels.electionId, electionIds));
        await tx
          .delete(electionSettings)
          .where(inArray(electionSettings.electionId, electionIds));
        await tx
          .delete(auditLogs)
          .where(inArray(auditLogs.electionId, electionIds));
        await tx.delete(elections).where(inArray(elections.id, electionIds));
      }

      // Clean up non-baseline audit logs (e.g. admin_login on active seed election)
      if (baseline) {
        if (baseline.auditLogIds.length > 0) {
          await tx
            .delete(auditLogs)
            .where(notInArray(auditLogs.id, baseline.auditLogIds));
        } else {
          await tx.delete(auditLogs);
        }
      }

      // Clean up test users + their accounts and sessions
      let nonBaselineUserIds: string[] = [];
      if (baseline && baseline.userIds.length > 0) {
        const extraUsers = await tx
          .select({ id: users.id })
          .from(users)
          .where(notInArray(users.id, baseline.userIds));
        nonBaselineUserIds = extraUsers.map((u) => u.id);
      }

      const allTestUserIds = Array.from(
        new Set([...explicitUserIds, ...nonBaselineUserIds])
      );

      if (allTestUserIds.length > 0) {
        await tx
          .delete(accounts)
          .where(inArray(accounts.userId, allTestUserIds));
        await tx
          .delete(sessions)
          .where(inArray(sessions.userId, allTestUserIds));
        await tx.delete(users).where(inArray(users.id, allTestUserIds));
      }

      // Clean up test sessions created for baseline admin/committee users
      if (baseline) {
        if (baseline.sessionIds.length > 0) {
          await tx
            .delete(sessions)
            .where(notInArray(sessions.id, baseline.sessionIds));
        } else {
          await tx.delete(sessions);
        }
      }
    } finally {
      await tx.execute(
        sql`ALTER TABLE audit_logs ENABLE TRIGGER trg_protect_audit_logs`
      );
    }
  });
}

/**
 * Generates an HMAC-signed `votera_voter_session` cookie value without
 * inserting a database row (useful for middleware or forged-session tests).
 */
export function createSignedVoterCookieValue(rawToken?: string): {
  rawToken: string;
  signature: string;
  cookieValue: string;
  sessionTokenHash: string;
} {
  const token = rawToken ?? crypto.randomBytes(32).toString("hex");
  const signature = signRawSessionToken(token);
  return {
    rawToken: token,
    signature,
    cookieValue: `${token}.${signature}`,
    sessionTokenHash: hashSessionToken(token),
  };
}

/**
 * Inserts a real `voter_sessions` row and returns the signed cookie value
 * ready to attach to a NextRequest.
 */
export async function createPersistedVoterSession(params: {
  voterId: string;
  electionId: string;
  ipAddress?: string;
  userAgent?: string | null;
}): Promise<{
  cookieValue: string;
  sessionTokenHash: string;
  expiresAt: Date;
}> {
  return createVoterSession({
    voterId: params.voterId,
    electionId: params.electionId,
    ipAddress: params.ipAddress ?? "127.0.0.1",
    userAgent: params.userAgent ?? "vitest-neon-harness",
  });
}

/**
 * Builds a `NextRequest` carrying a signed `votera_voter_session` cookie.
 */
export function createVoterNextRequest(
  url: string,
  cookieValue: string | null | undefined,
  options?: TestNextRequestOptions
): NextRequest {
  const method = (options?.method ?? "GET").toUpperCase();
  const headers = new Headers(options?.headers);

  if (cookieValue) {
    const existingCookie = headers.get("cookie");
    const voterCookiePart = `${VOTER_SESSION_COOKIE}=${cookieValue}`;
    headers.set(
      "cookie",
      existingCookie ? `${existingCookie}; ${voterCookiePart}` : voterCookiePart
    );
  }

  if (options?.ip) {
    headers.set("x-forwarded-for", options.ip);
  }

  const canHaveBody = method !== "GET" && method !== "HEAD";
  let serializedBody: string | undefined;
  if (canHaveBody && options?.body !== undefined) {
    if (typeof options.body === "string") {
      serializedBody = options.body;
    } else {
      serializedBody = JSON.stringify(options.body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }
  }

  return new NextRequest(url, {
    method,
    headers,
    ...(serializedBody !== undefined ? { body: serializedBody } : {}),
  });
}

/**
 * Signs in via Better Auth (`auth.api.signInUsername`) and returns the parsed
 * `Cookie` header string along with the user's ID.
 */
export async function signInAdminWithUsername(credentials: {
  username: string;
  password: string;
}): Promise<AdminCookieResult> {
  signInCounter += 1;
  const syntheticIp = `10.250.${Math.floor(signInCounter / 250) % 250}.${
    (signInCounter % 250) + 1
  }`;

  const response = await auth.api.signInUsername({
    body: {
      username: credentials.username,
      password: credentials.password,
    },
    headers: new Headers({
      "x-forwarded-for": syntheticIp,
    }),
    asResponse: true,
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `signInAdminWithUsername gagal untuk "${credentials.username}" (${response.status}): ${bodyText}`
    );
  }

  const cookie = extractCookieHeader(response);
  if (!cookie) {
    throw new Error(
      `signInAdminWithUsername tidak mengembalikan Set-Cookie untuk "${credentials.username}".`
    );
  }

  const [userRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, credentials.username))
    .limit(1);

  return {
    cookie,
    userId: userRow?.id ?? null,
  };
}

/**
 * Signs in as a seeded admin role (`super_admin` or `committee`).
 */
export async function signInSeedAdmin(
  role: "super_admin" | "committee"
): Promise<AdminCookieResult> {
  if (role === "super_admin") {
    return signInAdminWithUsername({
      username: process.env.INITIAL_ADMIN_USERNAME || "admin",
      password: process.env.INITIAL_ADMIN_PASSWORD || "AdminPilketos2026!Secure",
    });
  }

  return signInAdminWithUsername({
    username: "panitia",
    password: "PanitiaPilketos2026!",
  });
}

/**
 * Builds a `NextRequest` carrying a Better Auth admin session cookie header.
 */
export function createAdminNextRequest(
  url: string,
  adminCookie: string | null | undefined,
  options?: TestNextRequestOptions
): NextRequest {
  const method = (options?.method ?? "GET").toUpperCase();
  const headers = new Headers(options?.headers);

  if (adminCookie) {
    const existingCookie = headers.get("cookie");
    headers.set(
      "cookie",
      existingCookie ? `${existingCookie}; ${adminCookie}` : adminCookie
    );
  }

  if (options?.ip) {
    headers.set("x-forwarded-for", options.ip);
  }

  const canHaveBody = method !== "GET" && method !== "HEAD";
  let serializedBody: string | undefined;
  if (canHaveBody && options?.body !== undefined) {
    if (typeof options.body === "string") {
      serializedBody = options.body;
    } else {
      serializedBody = JSON.stringify(options.body);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
    }
  }

  return new NextRequest(url, {
    method,
    headers,
    ...(serializedBody !== undefined ? { body: serializedBody } : {}),
  });
}
