import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import { createUser, findUserById } from "@/lib/repositories/userRepository";
import { cleanupExpiredUnverifiedAccounts } from "@/lib/cleanup/expiredAccounts";

describe("cleanupExpiredUnverifiedAccounts", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDatabase(":memory:");
  });

  it("deletes unverified accounts older than 24 hours and returns the count removed", () => {
    const stale = createUser(db, { email: "stale@example.com", passwordHash: "h", passwordSalt: "s" });
    db.prepare(`UPDATE users SET created_at = datetime('now', '-25 hours') WHERE id = ?`).run(
      stale.id,
    );
    const fresh = createUser(db, { email: "fresh@example.com", passwordHash: "h", passwordSalt: "s" });

    const deletedCount = cleanupExpiredUnverifiedAccounts(db);

    expect(deletedCount).toBe(1);
    expect(findUserById(db, stale.id)).toBeUndefined();
    expect(findUserById(db, fresh.id)).toBeDefined();
  });

  it("returns 0 when there is nothing to clean up", () => {
    createUser(db, { email: "fresh@example.com", passwordHash: "h", passwordSalt: "s" });

    expect(cleanupExpiredUnverifiedAccounts(db)).toBe(0);
  });
});
