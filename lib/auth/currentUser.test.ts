import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
  }),
}));

const { createDatabase } = await import("@/lib/db");
const { createUser } = await import("@/lib/repositories/userRepository");
const { createSessionToken, SESSION_COOKIE_NAME } = await import("@/lib/auth/session");
const { getCurrentUser, requireCurrentUser } = await import("@/lib/auth/currentUser");

describe("currentUser", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDatabase(":memory:");
    cookieStore.clear();
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
  });

  it("returns null when there is no session cookie", async () => {
    expect(await getCurrentUser(db)).toBeNull();
  });

  it("returns the user for a valid session cookie", async () => {
    const user = createUser(db, { email: "a@example.com", passwordHash: "h", passwordSalt: "s" });
    cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user.id, user.tokenVersion));

    const resolved = await getCurrentUser(db);

    expect(resolved?.id).toBe(user.id);
  });

  it("requireCurrentUser throws when there is no valid session", async () => {
    await expect(requireCurrentUser(db)).rejects.toThrow(/unauthorized/i);
  });

  it("requireCurrentUser resolves the user when there is a valid session", async () => {
    const user = createUser(db, { email: "b@example.com", passwordHash: "h", passwordSalt: "s" });
    cookieStore.set(SESSION_COOKIE_NAME, createSessionToken(user.id, user.tokenVersion));

    const resolved = await requireCurrentUser(db);

    expect(resolved.id).toBe(user.id);
  });
});
