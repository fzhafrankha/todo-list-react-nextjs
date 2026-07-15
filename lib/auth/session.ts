import { createHmac, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { findUserById } from "@/lib/repositories/userRepository";
import type { User } from "@/lib/types";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  userId: number;
  tokenVersion: number;
  expiresAt: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET environment variable must be set to a random string of at least 32 characters.",
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Stateless, HMAC-signed session token. No server-side session store required. */
export function createSessionToken(
  userId: number,
  tokenVersion: number,
  ttlMs: number = SESSION_TTL_MS,
): string {
  const payload: SessionPayload = {
    userId,
    tokenVersion,
    expiresAt: Date.now() + ttlMs,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies signature and expiry only — no database access. Safe to call from
 * middleware for a fast redirect decision. Does NOT check token revocation;
 * `getSessionUser` below performs the full, authoritative check.
 */
export function verifySessionSignature(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = Buffer.from(sign(encodedPayload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.userId !== "number" || typeof payload.tokenVersion !== "number") {
      return null;
    }
    if (payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Authoritative session check: verifies the signature, then confirms the
 * embedded token version still matches the user's current version. A
 * password reset bumps that version, instantly invalidating every
 * previously issued session token without needing a session table.
 */
export function getSessionUser(db: DatabaseSync, token: string | undefined): User | null {
  if (!token) {
    return null;
  }
  const payload = verifySessionSignature(token);
  if (!payload) {
    return null;
  }
  const user = findUserById(db, payload.userId);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    return null;
  }
  return user;
}
