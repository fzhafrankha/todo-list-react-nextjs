import { cookies } from "next/headers";
import type { DatabaseSync } from "node:sqlite";
import { getSessionUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { User } from "@/lib/types";

export async function getCurrentUser(db: DatabaseSync): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUser(db, token);
}

/** Throws if there is no valid session. Use in Server Actions that mutate user data. */
export async function requireCurrentUser(db: DatabaseSync): Promise<User> {
  const user = await getCurrentUser(db);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
