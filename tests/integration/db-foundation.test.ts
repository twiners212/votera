import { describe, it, expect } from "vitest";
import { sql, eq, inArray } from "drizzle-orm";
import { verifyPassword } from "better-auth/crypto";
import {
  db,
  dbPool,
  users,
  accounts,
  elections,
  electionSettings,
  gradeLevels,
  majors,
  voterGroups,
  voters,
  votes,
  candidates,
  auditLogs,
} from "@/db";
import {
  VOTER_TOKEN_ALPHABET,
  decryptVoterToken,
  verifyVoterToken,
} from "@/lib/crypto/token";

describe("Database Foundation, Schema Isolation, Trigger & Seed Idempotency", () => {
  it("connects via both neon-http (db) and neon-serverless Pool (dbPool)", async () => {
    const httpRes = await db.execute(sql`SELECT 1 AS ok`);
    expect(httpRes.rows[0]).toEqual({ ok: 1 });

    const poolRes = await dbPool.execute(sql`SELECT 1 AS ok`);
    expect(poolRes.rows[0]).toEqual({ ok: 1 });
  });

  it("has all 14 core tables in public schema and drizzle migrations table", async () => {
    const res = await db.execute(sql`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'drizzle')
      ORDER BY table_schema, table_name
    `);

    const publicTables = res.rows
      .filter((r) => r.table_schema === "public")
      .map((r) => String(r.table_name));
    const drizzleTables = res.rows
      .filter((r) => r.table_schema === "drizzle")
      .map((r) => String(r.table_name));

    expect(publicTables).toEqual([
      "accounts",
      "audit_logs",
      "candidates",
      "election_settings",
      "elections",
      "grade_levels",
      "majors",
      "sessions",
      "users",
      "verifications",
      "voter_groups",
      "voter_sessions",
      "voters",
      "votes",
    ]);
    expect(drizzleTables).toContain("__drizzle_migrations");
  });

  it("enforces unlinkable anonymous votes table (no voter_id/ip_address, minute-truncated created_at)", async () => {
    const cols = await db.execute(sql`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'votes'
      ORDER BY ordinal_position
    `);

    const colNames = cols.rows.map((c) => String(c.column_name));
    expect(colNames).toEqual(["id", "election_id", "candidate_id", "created_at"]);
    expect(colNames).not.toContain("voter_id");
    expect(colNames).not.toContain("ip_address");

    const createdAtCol = cols.rows.find((c) => c.column_name === "created_at");
    expect(String(createdAtCol?.column_default)).toContain("date_trunc");
  });

  it("blocks UPDATE and DELETE on audit_logs via trg_protect_audit_logs", async () => {
    await expect(
      db.execute(sql`UPDATE audit_logs SET description = 'tampered'`)
    ).rejects.toThrow(/Security Violation/);

    await expect(
      db.execute(sql`DELETE FROM audit_logs`)
    ).rejects.toThrow(/Security Violation/);
  });

  it("contains expected idempotent seed counts and valid admin/voter credentials for PILKETOS 2026", async () => {
    const seedUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, ["usr_super_admin_01", "usr_committee_01"]));
    const seedAccounts = await db
      .select()
      .from(accounts)
      .where(
        inArray(accounts.userId, ["usr_super_admin_01", "usr_committee_01"])
      );
    const seedElections = await db
      .select()
      .from(elections)
      .where(eq(elections.slug, "pilketos-2026"));

    expect(seedUsers).toHaveLength(2);
    expect(seedAccounts).toHaveLength(2);
    expect(seedElections).toHaveLength(1);

    const seedElection = seedElections[0];
    expect(seedElection.slug).toBe("pilketos-2026");

    const seedSettings = await db
      .select()
      .from(electionSettings)
      .where(eq(electionSettings.electionId, seedElection.id));
    const seedGrades = await db
      .select()
      .from(gradeLevels)
      .where(eq(gradeLevels.electionId, seedElection.id));
    const seedMajors = await db
      .select()
      .from(majors)
      .where(eq(majors.electionId, seedElection.id));
    const seedGroups = await db
      .select()
      .from(voterGroups)
      .where(eq(voterGroups.electionId, seedElection.id));
    const seedCandidates = await db
      .select()
      .from(candidates)
      .where(eq(candidates.electionId, seedElection.id));
    const seedVoters = await db
      .select()
      .from(voters)
      .where(eq(voters.electionId, seedElection.id));
    const seedVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.electionId, seedElection.id));
    const seedLogs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.electionId, seedElection.id));

    expect(seedSettings).toHaveLength(1);
    expect(seedSettings[0].idLabel).toBe("NIS");
    expect(seedGrades.length).toBeGreaterThanOrEqual(3);
    expect(seedMajors.length).toBeGreaterThanOrEqual(2);
    expect(seedGroups.length).toBeGreaterThanOrEqual(7);
    expect(seedVoters.length).toBeGreaterThanOrEqual(76);
    expect(seedLogs.length).toBeGreaterThanOrEqual(5);

    const [adminAcc] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, "usr_super_admin_01"));
    expect(adminAcc?.password).toBeTruthy();
    const expectedAdminPassword =
      process.env.INITIAL_ADMIN_PASSWORD || "AdminPilketos2026!Secure";
    await expect(
      verifyPassword({
        hash: adminAcc!.password!,
        password: expectedAdminPassword,
      })
    ).resolves.toBe(true);

    const votedVoters = seedVoters.filter((v) => v.hasVoted);
    for (const v of votedVoters) {
      expect(v.tokenEncrypted).toBe("[REDACTED]");
      expect(decryptVoterToken(v.tokenEncrypted)).toBe("••••••••");
    }

    const unvotedVoters = seedVoters.filter((v) => !v.hasVoted);
    expect(unvotedVoters.length).toBeGreaterThanOrEqual(74);
    for (const v of unvotedVoters) {
      const plainToken = decryptVoterToken(v.tokenEncrypted);
      expect(plainToken).toHaveLength(8);
      for (const ch of plainToken) {
        expect(VOTER_TOKEN_ALPHABET).toContain(ch);
      }
      expect(verifyVoterToken(plainToken, v.tokenHash)).toBe(true);
    }

    const demoVoter = seedVoters.find((v) => v.voterIdentity === "2324001") || unvotedVoters[0];
    expect(demoVoter).toBeDefined();
    if (demoVoter!.hasVoted) {
      expect(decryptVoterToken(demoVoter!.tokenEncrypted)).toBe("••••••••");
    } else {
      expect(decryptVoterToken(demoVoter!.tokenEncrypted)).toHaveLength(8);
    }
  });
});
