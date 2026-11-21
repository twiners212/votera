export const VOTER_SESSION_COOKIE = "votera_voter_session";
export const VOTER_SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 jam

const DEV_FALLBACK_VOTER_SESSION_SECRET =
  "votera-dev-voter-session-secret-fallback-do-not-use-in-prod";

const HEX_64_REGEX = /^[0-9a-f]{64}$/;

export function getVoterSessionSecret(): string {
  const secret = process.env.VOTER_SESSION_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "VOTER_SESSION_SECRET wajib disetel pada environment production."
      );
    }
    return DEV_FALLBACK_VOTER_SESSION_SECRET;
  }
  return secret;
}

export function parseVoterSessionCookieParts(
  cookieValue: string | undefined | null
): { rawToken: string; signature: string } | null {
  if (!cookieValue || typeof cookieValue !== "string") {
    return null;
  }

  const parts = cookieValue.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [rawToken, signature] = parts;
  if (!HEX_64_REGEX.test(rawToken) || !HEX_64_REGEX.test(signature)) {
    return null;
  }

  return { rawToken, signature };
}

export async function verifyVoterSessionCookieEdge(
  cookieValue: string | undefined | null
): Promise<boolean> {
  const parsed = parseVoterSessionCookieParts(cookieValue);
  if (!parsed) {
    return false;
  }

  try {
    const secret = getVoterSessionSecret();
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(parsed.rawToken)
    );
    const expectedHex = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedHex.length !== parsed.signature.length) {
      return false;
    }

    let diff = 0;
    for (let i = 0; i < expectedHex.length; i++) {
      diff |= expectedHex.charCodeAt(i) ^ parsed.signature.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
