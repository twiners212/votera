try {
  (process as any).loadEnvFile(".env.local");
} catch {}

async function main() {
  const { db } = await import("@/db");
  const { voters, voterSessions } = await import("@/db/schema");
  const { eq, inArray, sql } = await import("drizzle-orm");
  const { hashVoterToken, encryptVoterToken, decryptVoterToken, verifyVoterToken } = await import("@/lib/crypto/token");

  console.log("Updating demo voter accounts in Neon DB...");

  const demoAccounts = [
    {
      nis: "2324001",
      token: "JUFT88TF",
      name: "Aditya Pratama",
    },
    {
      nis: "2324011",
      token: "P8TYM5KR",
      name: "Anisa Rahmawati",
    },
    {
      nis: "2324002",
      token: "WPMTTE6G", // previous generated token or predictable
      name: "Ahmad Fauzi",
    },
    {
      nis: "2324003",
      token: "HHZU7B48",
      name: "Dewi Sartika",
    },
  ];

  for (const acc of demoAccounts) {
    const tokenHash = hashVoterToken(acc.token);
    const tokenEncrypted = encryptVoterToken(acc.token);

    // Verify hash matches
    const isValid = verifyVoterToken(acc.token, tokenHash);
    if (!isValid) {
      throw new Error(`Token verification self-check failed for ${acc.nis}`);
    }

    const [updated] = await db
      .update(voters)
      .set({
        tokenHash,
        tokenEncrypted,
        hasVoted: false,
        voterStatus: "not_voted",
        failedLoginAttempts: 0,
        lockedUntil: null,
        votedAt: null,
        updatedAt: sql`now()`,
      })
      .where(eq(voters.voterIdentity, acc.nis))
      .returning();

    if (updated) {
      // Hapus sesi lama jika ada
      await db.delete(voterSessions).where(eq(voterSessions.voterId, updated.id));
      console.log(`✓ Updated demo voter ${acc.nis} (${acc.name}) -> Token: ${acc.token} [Decrypted check: ${decryptVoterToken(updated.tokenEncrypted)}]`);
    } else {
      console.warn(`! Voter ${acc.nis} not found in database`);
    }
  }

  console.log("Demo voters successfully updated and ready for login!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to update demo voters:", err);
  process.exit(1);
});
