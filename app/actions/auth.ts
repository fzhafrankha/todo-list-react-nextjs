"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL_MS } from "@/lib/auth/session";
import { issueToken, consumeToken } from "@/lib/auth/tokens";
import { checkRateLimit } from "@/lib/auth/rateLimit";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email/mailer";
import {
  createUser,
  findUserByEmail,
  markEmailVerified,
  updatePassword,
  incrementTokenVersion,
} from "@/lib/repositories/userRepository";
import {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from "@/lib/schemas/auth";

const EMAIL_VERIFICATION_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

const GENERIC_INVALID_CREDENTIALS = "Invalid email or password.";
const GENERIC_RESET_SENT = "If that email exists, a password reset link has been sent.";
const GENERIC_VERIFICATION_SENT =
  "If that account exists and isn't verified yet, a new link has been sent.";
const GENERIC_REGISTER_SENT =
  "If that email isn't already registered, check your inbox to verify your address.";

// Precomputed once so loginAction always pays the same scrypt cost whether or
// not the account exists — otherwise an attacker can distinguish "no such
// account" (fast) from "wrong password" (slow) by timing the response, which
// defeats the point of the single generic error message below.
const DUMMY_PASSWORD_HASH = hashPassword("dummy-password-for-constant-time-comparison");

export interface ActionState {
  error?: string;
  success?: string;
}

/**
 * Swallows an email-send failure and returns the same generic message the
 * caller would have returned on success. This is deliberate, not an
 * oversight: a distinct "we couldn't send the email" message would only ever
 * appear for requests that got as far as attempting a send (i.e. an account
 * that exists / didn't already exist), which would reopen the exact
 * enumeration channel these generic responses exist to close. Users who
 * don't receive an email can just retry, which is itself rate-limited.
 */
async function attemptSend(send: () => Promise<void>): Promise<void> {
  try {
    await send();
  } catch {
    // Intentionally ignored — see doc comment above.
  }
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and a password of at least 8 characters." };
  }
  const { email, password } = parsed.data;

  if (!checkRateLimit(`register:${email}`, 5, 60 * 60 * 1000)) {
    return { error: "Too many attempts. Try again later." };
  }
  // Global cap in addition to the per-email one above, so a script can't
  // create unlimited accounts (and relay unlimited emails to arbitrary
  // third-party inboxes) by iterating through many different addresses.
  if (!checkRateLimit("register:global", 20, 60 * 60 * 1000)) {
    return { error: "Too many attempts. Try again later." };
  }

  const db = getDb();
  if (!findUserByEmail(db, email)) {
    const { hash, salt } = hashPassword(password);
    const user = createUser(db, { email, passwordHash: hash, passwordSalt: salt });
    const token = issueToken(db, user.id, "email_verification", EMAIL_VERIFICATION_TTL_MS);
    await attemptSend(() => sendVerificationEmail(email, token));
  }

  return { success: GENERIC_REGISTER_SENT };
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: GENERIC_INVALID_CREDENTIALS };
  }
  const { email, password } = parsed.data;

  if (!checkRateLimit(`login:${email}`, 10, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Try again later." };
  }

  const db = getDb();
  const user = findUserByEmail(db, email);
  const isValidPassword = user
    ? verifyPassword(password, user.passwordHash, user.passwordSalt)
    : verifyPassword(password, DUMMY_PASSWORD_HASH.hash, DUMMY_PASSWORD_HASH.salt);
  if (!user || !isValidPassword) {
    return { error: GENERIC_INVALID_CREDENTIALS };
  }
  if (!user.emailVerifiedAt) {
    return {
      error: "Please verify your email before logging in. Check your inbox, or request a new link below.",
    };
  }

  const token = createSessionToken(user.id, user.tokenVersion);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  // Clears the cookie client-side only; tokenVersion (the only revocation
  // mechanism) is deliberately not bumped here because it's per-user, not
  // per-session — doing so would also log the user out of every other
  // device. A copy of this token exfiltrated before logout therefore
  // remains valid until it expires (see SESSION_TTL_MS in lib/auth/session.ts).
  // Fixing that requires a server-side per-session revocation list, which
  // this app's stateless-session design deliberately avoids. Accepted tradeoff.
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

/**
 * Requires an explicit form submission (POST), not a bare page load (GET).
 * Corporate mail scanners (e.g. Safe Links) auto-fetch every URL in an
 * incoming email to check for malware, which would otherwise burn this
 * single-use token before the real recipient ever clicks it.
 */
export async function verifyEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) {
    return { error: "Missing verification token." };
  }

  const db = getDb();
  const userId = consumeToken(db, token, "email_verification");
  if (!userId) {
    return { error: "This verification link is invalid or has expired." };
  }
  markEmailVerified(db, userId);
  return { success: "Your email is verified. You can now log in." };
}

export async function resendVerificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resendVerificationSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { success: GENERIC_VERIFICATION_SENT };
  }
  const { email } = parsed.data;

  if (!checkRateLimit(`resend-verify:${email}`, 3, 60 * 60 * 1000)) {
    return { success: GENERIC_VERIFICATION_SENT };
  }

  const db = getDb();
  const user = findUserByEmail(db, email);
  if (user && !user.emailVerifiedAt) {
    const token = issueToken(db, user.id, "email_verification", EMAIL_VERIFICATION_TTL_MS);
    await attemptSend(() => sendVerificationEmail(email, token));
  }
  return { success: GENERIC_VERIFICATION_SENT };
}

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { success: GENERIC_RESET_SENT };
  }
  const { email } = parsed.data;

  if (!checkRateLimit(`reset-request:${email}`, 3, 60 * 60 * 1000)) {
    return { success: GENERIC_RESET_SENT };
  }

  const db = getDb();
  const user = findUserByEmail(db, email);
  if (user) {
    const token = issueToken(db, user.id, "password_reset", PASSWORD_RESET_TTL_MS);
    await attemptSend(() => sendPasswordResetEmail(email, token));
  }
  return { success: GENERIC_RESET_SENT };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter a password of at least 8 characters." };
  }
  const { token, password } = parsed.data;

  const db = getDb();
  const userId = consumeToken(db, token, "password_reset");
  if (!userId) {
    return { error: "This reset link is invalid or has expired." };
  }

  const { hash, salt } = hashPassword(password);
  updatePassword(db, userId, { passwordHash: hash, passwordSalt: salt });
  incrementTokenVersion(db, userId);

  return { success: "Password updated. You can now log in." };
}
