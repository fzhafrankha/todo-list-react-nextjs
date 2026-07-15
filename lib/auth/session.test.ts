import { beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import { createUser, incrementTokenVersion } from "@/lib/repositories/userRepository";
import {
  createSessionToken,
  verifySessionSignature,
  getSessionUser,
} from "@/lib/auth/session";

const SESSION_SECRET = "a".repeat(32);

describe("session tokens", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    process.env.SESSION_SECRET = SESSION_SECRET;
    db = createDatabase(":memory:");
  });

  it("round-trips a valid session token through signature verification", () => {
    const token = createSessionToken(42, 0);

    const payload = verifySessionSignature(token);

    expect(payload).toEqual({ userId: 42, tokenVersion: 0, expiresAt: expect.any(Number) });
  });

  it("rejects a payload tampered to impersonate a different user", () => {
    const token = createSessionToken(42, 0);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ userId: 999, tokenVersion: 0, expiresAt: Date.now() + 60_000 }),
    ).toString("base64url");

    const tampered = `${forgedPayload}.${signature}`;

    expect(verifySessionSignature(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(1, 0, -1);

    expect(verifySessionSignature(token)).toBeNull();
  });

  it("resolves the current user for a valid session", () => {
    const user = createUser(db, {
      email: "a@example.com",
      passwordHash: "h",
      passwordSalt: "s",
    });
    const token = createSessionToken(user.id, user.tokenVersion);

    const resolved = getSessionUser(db, token);

    expect(resolved?.id).toBe(user.id);
  });

  it("invalidates existing sessions after the user's token version is bumped (e.g. password reset)", () => {
    const user = createUser(db, {
      email: "a@example.com",
      passwordHash: "h",
      passwordSalt: "s",
    });
    const token = createSessionToken(user.id, user.tokenVersion);

    incrementTokenVersion(db, user.id);

    expect(getSessionUser(db, token)).toBeNull();
  });

  it("returns null for a missing token", () => {
    expect(getSessionUser(db, undefined)).toBeNull();
  });

  it("returns null for a session belonging to a user that no longer exists", () => {
    const token = createSessionToken(999_999, 0);

    expect(getSessionUser(db, token)).toBeNull();
  });

  it("rejects a token with no signature segment", () => {
    expect(verifySessionSignature("just-a-payload-no-dot")).toBeNull();
  });

  it("rejects a token whose payload is not valid JSON, even with a correctly matching signature", () => {
    const garbagePayload = Buffer.from("not json").toString("base64url");
    const signature = createHmac("sha256", SESSION_SECRET)
      .update(garbagePayload)
      .digest("base64url");

    expect(verifySessionSignature(`${garbagePayload}.${signature}`)).toBeNull();
  });
});
