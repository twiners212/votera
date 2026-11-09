import { describe, it, expect } from "vitest";
import {
  generateVoterToken,
  hashVoterToken,
  verifyVoterToken,
  encryptVoterToken,
  decryptVoterToken,
} from "../../src/lib/crypto/token";

describe("Crypto Token Utilities (Votera Security-Critical)", () => {
  const NON_AMBIGUOUS_REGEX = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

  it("harus menghasilkan token 8 karakter dari alfabet non-ambigu (tanpa 0, O, 1, I, L)", () => {
    for (let i = 0; i < 50; i++) {
      const token = generateVoterToken();
      expect(token).toHaveLength(8);
      expect(token).toMatch(NON_AMBIGUOUS_REGEX);
      expect(token).not.toMatch(/[0O1IL]/);
    }
  });

  it("harus menghasilkan hash HMAC-SHA256 yang konsisten dan insensitive terhadap huruf kecil", () => {
    const token = "JUFT88TF";
    const hash1 = hashVoterToken(token);
    const hash2 = hashVoterToken("juft88tf");
    const hash3 = hashVoterToken("  JUFT88TF  ");

    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
    expect(hash1).toHaveLength(64); // SHA-256 menghasilkan 64 hex characters
  });

  it("harus memverifikasi token yang benar dan menolak token yang salah secara timing-safe", () => {
    const token = "PYBRYG4V";
    const hash = hashVoterToken(token);

    expect(verifyVoterToken("PYBRYG4V", hash)).toBe(true);
    expect(verifyVoterToken("pybryg4v", hash)).toBe(true);
    expect(verifyVoterToken("WRONGTKN", hash)).toBe(false);
    expect(verifyVoterToken("", hash)).toBe(false);
    expect(verifyVoterToken("PYBRYG4", hash)).toBe(false);
  });

  it("harus mengenkripsi dan mendekripsi token dengan AES-256-GCM secara reversibel", () => {
    const token = "KJ2TRDQG";
    const encrypted = encryptVoterToken(token);

    expect(encrypted).toContain(":");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3); // iv : authTag : ciphertext

    const decrypted = decryptVoterToken(encrypted);
    expect(decrypted).toBe(token);
  });

  it("harus mengembalikan bullet tersembunyi jika token telah diredaksi ([REDACTED])", () => {
    expect(decryptVoterToken("[REDACTED]")).toBe("••••••••");
    expect(decryptVoterToken("")).toBe("••••••••");
  });
});
