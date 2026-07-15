import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, getDb } from "@/lib/db";

describe("createDatabase", () => {
  it("creates the users, todos, and auth_tokens tables for an in-memory database", () => {
    const db = createDatabase(":memory:");

    const tables = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as { name: string }[]
    ).map((row) => row.name);

    expect(tables).toEqual(expect.arrayContaining(["users", "todos", "auth_tokens"]));
  });

  it("creates the parent directory for a file-backed database that doesn't exist yet", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "todo-db-test-")), "nested", "path");
    const dbPath = join(dir, "todos.db");

    expect(existsSync(dir)).toBe(false);
    createDatabase(dbPath);
    expect(existsSync(dir)).toBe(true);

    rmSync(join(dir, ".."), { recursive: true, force: true });
  });
});

describe("getDb", () => {
  const originalPath = process.env.DATABASE_PATH;

  beforeEach(() => {
    process.env.DATABASE_PATH = ":memory:";
  });

  afterEach(() => {
    process.env.DATABASE_PATH = originalPath;
  });

  it("returns the same singleton instance on every call", () => {
    const first = getDb();
    const second = getDb();

    expect(first).toBe(second);
  });
});
