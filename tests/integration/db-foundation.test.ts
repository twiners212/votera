import { describe, it, expect } from "vitest";
import { sql, eq } from "drizzle-orm";
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
    const allUsers = await db.select().from(users);
    const allAccounts = await db.select().from(accounts);
    const allElections = await db.select().from(elections);
    const allSettings = await db.select().from(electionSettings);
    const allGrades = await db.select().from(gradeLevels);
    const allMajors = await db.select().from(majors);
    const allGroups = await db.select().from(voterGroups);
    const allCandidates = await db.select().from(candidates);
    const allVoters = await db.select().from(voters);
    const allVotes = await db.select().from(votes);
    const allLogs = await db.select().from(auditLogs);

    expect(allUsers).toHaveLength(2);
    expect(allAccounts).toHaveLength(2);
    expect(allElections).toHaveLength(1);
    expect(allElections[0].slug).toBe("pilketos-2026");
    expect(allSettings).toHaveLength(1);
    expect(allSettings[0].idLabel).toBe("NIS");
    expect(allGrades).toHaveLength(3);
    expect(allMajors).toHaveLength(2);
    expect(allGroups).toHaveLength(7);
    expect(allCandidates).toHaveLength(4);
    expect(allVoters).toHaveLength(76);
    expect(allVotes).toHaveLength(2);
    expect(allLogs).toHaveLength(5);

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

    const votedVoters = allVoters.filter((v) => v.hasVoted);
    expect(votedVoters).toHaveLength(2);
    for (const v of votedVoters) {
      expect(v.tokenEncrypted).toBe("[REDACTED]");
      expect(decryptVoterToken(v.tokenEncrypted)).toBe("••••••••");
    }

    const unvotedVoters = allVoters.filter((v) => !v.hasVoted);
    expect(unvotedVoters).toHaveLength(74);
    for (const v of unvotedVoters) {
      const plainToken = decryptVoterToken(v.tokenEncrypted);
      expect(plainToken).toHaveLength(8);
      for (const ch of plainToken) {
        expect(VOTER_TOKEN_ALPHABET).toContain(ch);
      }
      expect(verifyVoterToken(plainToken, v.tokenHash)).toBe(true);
    }

    const demoVoter = allVoters.find((v) => v.voterIdentity === "2324001");
    expect(demoVoter).toBeDefined();
    expect(decryptVoterToken(demoVoter!.tokenEncrypted)).toBe("JUFT88TF");
  });
});
