import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import {
  createUser,
  findUserByEmail,
  findUserById,
  markEmailVerified,
  updatePassword,
  incrementTokenVersion,
  deleteUnverifiedUsersOlderThan,
} from "@/lib/repositories/userRepository";

function setCreatedAt(db: DatabaseSync, userId: number, sqliteModifier: string): void {
  db.prepare(`UPDATE users SET created_at = datetime('now', ?) WHERE id = ?`).run(
    sqliteModifier,
    userId,
  );
}

describe("userRepository", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDatabase(":memory:");
  });

  it("creates a user with an unverified email and token version 0", () => {
    const user = createUser(db, {
      email: "new@example.com",
      passwordHash: "hash",
      passwordSalt: "salt",
    });

    expect(user.email).toBe("new@example.com");
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.tokenVersion).toBe(0);
  });

  it("finds a user by email", () => {
    createUser(db, { email: "find-me@example.com", passwordHash: "h", passwordSalt: "s" });

    const found = findUserByEmail(db, "find-me@example.com");

    expect(found?.email).toBe("find-me@example.com");
  });

  it("returns undefined when no user matches the email", () => {
    expect(findUserByEmail(db, "missing@example.com")).toBeUndefined();
  });

  it("finds a user by id", () => {
    const created = createUser(db, { email: "id@example.com", passwordHash: "h", passwordSalt: "s" });

    const found = findUserById(db, created.id);

    expect(found?.id).toBe(created.id);
  });

  it("marks a user's email as verified", () => {
    const user = createUser(db, { email: "verify@example.com", passwordHash: "h", passwordSalt: "s" });

    markEmailVerified(db, user.id);

    expect(findUserById(db, user.id)?.emailVerifiedAt).not.toBeNull();
  });

  it("updates a user's password hash and salt", () => {
    const user = createUser(db, { email: "pw@example.com", passwordHash: "old", passwordSalt: "old" });

    updatePassword(db, user.id, { passwordHash: "new-hash", passwordSalt: "new-salt" });

    const updated = findUserById(db, user.id);
    expect(updated?.passwordHash).toBe("new-hash");
    expect(updated?.passwordSalt).toBe("new-salt");
  });

  it("increments token version, invalidating previously issued sessions", () => {
    const user = createUser(db, { email: "tv@example.com", passwordHash: "h", passwordSalt: "s" });

    incrementTokenVersion(db, user.id);
    incrementTokenVersion(db, user.id);

    expect(findUserById(db, user.id)?.tokenVersion).toBe(2);
  });

  it("rejects a second user registering with the same email", () => {
    createUser(db, { email: "dup@example.com", passwordHash: "h", passwordSalt: "s" });

    expect(() =>
      createUser(db, { email: "dup@example.com", passwordHash: "h2", passwordSalt: "s2" }),
    ).toThrow();
  });

  describe("deleteUnverifiedUsersOlderThan", () => {
    it("deletes an unverified account created more than the cutoff ago", () => {
      const user = createUser(db, { email: "stale@example.com", passwordHash: "h", passwordSalt: "s" });
      setCreatedAt(db, user.id, "-25 hours");

      const deletedCount = deleteUnverifiedUsersOlderThan(db, 24);

      expect(deletedCount).toBe(1);
      expect(findUserById(db, user.id)).toBeUndefined();
    });

    it("keeps an unverified account created less than the cutoff ago", () => {
      const user = createUser(db, { email: "fresh@example.com", passwordHash: "h", passwordSalt: "s" });
      setCreatedAt(db, user.id, "-1 hours");

      const deletedCount = deleteUnverifiedUsersOlderThan(db, 24);

      expect(deletedCount).toBe(0);
      expect(findUserById(db, user.id)).toBeDefined();
    });

    it("keeps a verified account even if created long ago", () => {
      const user = createUser(db, { email: "old-verified@example.com", passwordHash: "h", passwordSalt: "s" });
      setCreatedAt(db, user.id, "-25 hours");
      markEmailVerified(db, user.id);

      const deletedCount = deleteUnverifiedUsersOlderThan(db, 24);

      expect(deletedCount).toBe(0);
      expect(findUserById(db, user.id)).toBeDefined();
    });

    it("cascades: deleting a stale unverified user also deletes their todos", () => {
      const user = createUser(db, { email: "cascade@example.com", passwordHash: "h", passwordSalt: "s" });
      setCreatedAt(db, user.id, "-25 hours");
      db.prepare(`INSERT INTO todos (user_id, title) VALUES (?, ?)`).run(user.id, "orphan todo");

      deleteUnverifiedUsersOlderThan(db, 24);

      const remainingTodos = db.prepare(`SELECT * FROM todos WHERE user_id = ?`).all(user.id);
      expect(remainingTodos).toHaveLength(0);
    });
  });
});
