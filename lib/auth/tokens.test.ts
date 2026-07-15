import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import { createUser } from "@/lib/repositories/userRepository";
import { issueToken, consumeToken } from "@/lib/auth/tokens";

describe("auth tokens", () => {
  let db: DatabaseSync;
  let userId: number;

  beforeEach(() => {
    db = createDatabase(":memory:");
    const user = createUser(db, {
      email: "user@example.com",
      passwordHash: "hash",
      passwordSalt: "salt",
    });
    userId = user.id;
  });

  it("consumes a freshly issued token and returns the owning user id", () => {
    const token = issueToken(db, userId, "email_verification", 60_000);

    const result = consumeToken(db, token, "email_verification");

    expect(result).toBe(userId);
  });

  it("rejects a token on second use (single-use enforcement)", () => {
    const token = issueToken(db, userId, "email_verification", 60_000);
    consumeToken(db, token, "email_verification");

    const secondAttempt = consumeToken(db, token, "email_verification");

    expect(secondAttempt).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = issueToken(db, userId, "email_verification", -1);

    const result = consumeToken(db, token, "email_verification");

    expect(result).toBeNull();
  });

  it("rejects a token checked against the wrong purpose", () => {
    const token = issueToken(db, userId, "password_reset", 60_000);

    const result = consumeToken(db, token, "email_verification");

    expect(result).toBeNull();
  });

  it("rejects a garbage/unknown token", () => {
    const result = consumeToken(db, "not-a-real-token", "email_verification");

    expect(result).toBeNull();
  });
});
