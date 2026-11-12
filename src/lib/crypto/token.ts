import crypto from "node:crypto";

export const VOTER_TOKEN_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const DEV_FALLBACK_HMAC_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const DEV_FALLBACK_ENCRYPTION_KEY =
  "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

function getHmacSecret(): string {
  const secret = process.env.TOKEN_HMAC_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TOKEN_HMAC_SECRET wajib disetel pada environment production."
      );
    }
    return DEV_FALLBACK_HMAC_SECRET;
  }
  return secret;
}

function getEncryptionKey(): Buffer {
  const hexKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hexKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TOKEN_ENCRYPTION_KEY wajib disetel pada environment production."
      );
    }
    return Buffer.from(DEV_FALLBACK_ENCRYPTION_KEY, "hex");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY harus berupa tepat 64 karakter hex (32 byte)."
    );
  }

  return Buffer.from(hexKey, "hex");
}

export function generateVoterToken(length = 8): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("Panjang token harus berupa bilangan bulat positif.");
  }

  let token = "";
  for (let i = 0; i < length; i++) {
    token += VOTER_TOKEN_ALPHABET[crypto.randomInt(0, VOTER_TOKEN_ALPHABET.length)];
  }
  return token;
}

export function hashVoterToken(token: string): string {
  const normalized = token.trim().toUpperCase();
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(normalized)
    .digest("hex");
}

export function verifyVoterToken(
  inputToken: string,
  storedHash: string
): boolean {
  if (
    !inputToken ||
    !inputToken.trim() ||
    !storedHash ||
    !/^[0-9a-fA-F]+$/.test(storedHash) ||
    storedHash.length % 2 !== 0
  ) {
    return false;
  }

  const inputHash = hashVoterToken(inputToken);
  const a = Buffer.from(inputHash, "hex");
  const b = Buffer.from(storedHash, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

export function encryptVoterToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptVoterToken(payload: string): string {
  if (!payload || payload === "[REDACTED]") {
    return "••••••••";
  }

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Format payload token terenkripsi tidak valid.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  if (
    !/^[0-9a-fA-F]{24}$/.test(ivHex) ||
    !/^[0-9a-fA-F]{32}$/.test(authTagHex) ||
    !/^[0-9a-fA-F]+$/.test(encryptedHex) ||
    encryptedHex.length % 2 !== 0
  ) {
    throw new Error("Struktur hex token terenkripsi tidak valid.");
  }

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
