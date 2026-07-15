import { randomBytes, createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  insertToken,
  findUnusedTokenByHash,
  markTokenUsed,
} from "@/lib/repositories/authTokenRepository";
import type { TokenPurpose } from "@/lib/types";

const TOKEN_BYTES = 32;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issues a single-use, expiring token for the given purpose (email verification
 * or password reset). Only the SHA-256 hash is persisted — the raw value is
 * returned once, for embedding in the email link, and is never stored.
 */
export function issueToken(
  db: DatabaseSync,
  userId: number,
  purpose: TokenPurpose,
  ttlMs: number,
): string {
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  insertToken(db, { userId, purpose, tokenHash: hashToken(raw), expiresAt });
  return raw;
}

/**
 * Verifies and consumes a token for the given purpose. A token issued for one
 * purpose (e.g. password_reset) can never satisfy a check for another purpose
 * (e.g. email_verification). Returns the associated user id, or null if the
 * token is missing, expired, already used, or wrong-purpose.
 */
export function consumeToken(
  db: DatabaseSync,
  raw: string,
  purpose: TokenPurpose,
): number | null {
  const token = findUnusedTokenByHash(db, hashToken(raw), purpose);
  if (!token) {
    return null;
  }
  if (new Date(token.expiresAt).getTime() < Date.now()) {
    return null;
  }
  markTokenUsed(db, token.id);
  return token.userId;
}
