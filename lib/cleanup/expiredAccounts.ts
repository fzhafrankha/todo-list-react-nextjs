import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/lib/db";
import { deleteUnverifiedUsersOlderThan } from "@/lib/repositories/userRepository";

const UNVERIFIED_ACCOUNT_TTL_HOURS = 24;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

export function cleanupExpiredUnverifiedAccounts(db: DatabaseSync): number {
  return deleteUnverifiedUsersOlderThan(db, UNVERIFIED_ACCOUNT_TTL_HOURS);
}

let started = false;

/**
 * Runs the cleanup once immediately, then hourly for the lifetime of the
 * process. This app assumes a single, long-running Node.js process (the
 * same assumption already made by the in-memory rate limiter in
 * lib/auth/rateLimit.ts) rather than a serverless/edge deployment, so a
 * plain setInterval is sufficient — no external scheduler needed.
 */
export function startExpiredAccountCleanup(): void {
  if (started) {
    return;
  }
  started = true;

  const db = getDb();
  cleanupExpiredUnverifiedAccounts(db);
  setInterval(() => cleanupExpiredUnverifiedAccounts(db), CLEANUP_INTERVAL_MS).unref();
}
