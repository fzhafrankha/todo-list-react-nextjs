import type { DatabaseSync } from "node:sqlite";
import type { User } from "@/lib/types";

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  password_salt: string;
  email_verified_at: string | null;
  token_version: number;
  created_at: string;
}

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    emailVerifiedAt: row.email_verified_at,
    tokenVersion: row.token_version,
    createdAt: row.created_at,
  };
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  passwordSalt: string;
}

export function createUser(db: DatabaseSync, input: CreateUserInput): User {
  const row = db
    .prepare(
      `INSERT INTO users (email, password_hash, password_salt)
       VALUES (?, ?, ?)
       RETURNING *`,
    )
    .get(input.email, input.passwordHash, input.passwordSalt) as unknown as UserRow;
  return mapRow(row);
}

export function findUserByEmail(db: DatabaseSync, email: string): User | undefined {
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email) as unknown as
    | UserRow
    | undefined;
  return row ? mapRow(row) : undefined;
}

export function findUserById(db: DatabaseSync, id: number): User | undefined {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as unknown as UserRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function markEmailVerified(db: DatabaseSync, userId: number): void {
  db.prepare(`UPDATE users SET email_verified_at = datetime('now') WHERE id = ?`).run(userId);
}

export interface UpdatePasswordInput {
  passwordHash: string;
  passwordSalt: string;
}

export function updatePassword(
  db: DatabaseSync,
  userId: number,
  input: UpdatePasswordInput,
): void {
  db.prepare(`UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?`).run(
    input.passwordHash,
    input.passwordSalt,
    userId,
  );
}

export function incrementTokenVersion(db: DatabaseSync, userId: number): void {
  db.prepare(`UPDATE users SET token_version = token_version + 1 WHERE id = ?`).run(userId);
}
