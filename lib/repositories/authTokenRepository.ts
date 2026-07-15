import type { DatabaseSync } from "node:sqlite";
import type { AuthToken, TokenPurpose } from "@/lib/types";

interface AuthTokenRow {
  id: number;
  user_id: number;
  purpose: TokenPurpose;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

function mapRow(row: AuthTokenRow): AuthToken {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}

export interface InsertTokenInput {
  userId: number;
  purpose: TokenPurpose;
  tokenHash: string;
  expiresAt: string;
}

export function insertToken(db: DatabaseSync, input: InsertTokenInput): AuthToken {
  const row = db
    .prepare(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
    )
    .get(input.userId, input.purpose, input.tokenHash, input.expiresAt) as unknown as AuthTokenRow;
  return mapRow(row);
}

/** Returns only tokens that have not been used yet; expiry is checked by the caller. */
export function findUnusedTokenByHash(
  db: DatabaseSync,
  tokenHash: string,
  purpose: TokenPurpose,
): AuthToken | undefined {
  const row = db
    .prepare(
      `SELECT * FROM auth_tokens
       WHERE token_hash = ? AND purpose = ? AND used_at IS NULL`,
    )
    .get(tokenHash, purpose) as unknown as AuthTokenRow | undefined;
  return row ? mapRow(row) : undefined;
}

export function markTokenUsed(db: DatabaseSync, tokenId: number): void {
  db.prepare(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?`).run(tokenId);
}
