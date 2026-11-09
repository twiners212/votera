import crypto from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function getHmacSecret(): string {
  const secret = process.env.TOKEN_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOKEN_HMAC_SECRET wajib disetel di environment variables produksi.");
    }
    return "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  }
  return secret;
}

function getEncryptionKey(): Buffer {
  const hexKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOKEN_ENCRYPTION_KEY wajib tepat 64 karakter hex (32 bytes).");
    }
    return Buffer.from("fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210", "hex");
  }
  return Buffer.from(hexKey, "hex");
}

/**
 * Menghasilkan token acak 8 karakter dari alfabet non-ambigu (tanpa 0, O, 1, I, L)
 * Menggunakan CSPRNG crypto.randomInt
 */
export function generateVoterToken(length = 8): string {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return token;
}

/**
 * Hashing token menggunakan HMAC-SHA256 untuk verifikasi login cepat
 */
export function hashVoterToken(token: string): string {
  const normalized = token.trim().toUpperCase();
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(normalized)
    .digest("hex");
}

/**
 * Verifikasi token terhadap hash tersimpan dengan perbandingan timing-safe
 */
export function verifyVoterToken(inputToken: string, storedHash: string): boolean {
  try {
    const inputHash = hashVoterToken(inputToken);
    const a = Buffer.from(inputHash, "hex");
    const b = Buffer.from(storedHash, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Enkripsi token menggunakan AES-256-GCM agar panitia dapat menyalin token dari tabel DPT
 */
export function encryptVoterToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Dekripsi token dari ciphertext AES-256-GCM.
 * Menangani token yang sudah diredaksi ([REDACTED]) saat pemilih selesai memilih.
 */
export function decryptVoterToken(payload: string): string {
  if (!payload || payload === "[REDACTED]") return "••••••••";
  try {
    const [ivHex, authTagHex, encryptedHex] = payload.split(":");
    if (!ivHex || !authTagHex || !encryptedHex) return "••••••••";
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "••••••••";
  }
}
