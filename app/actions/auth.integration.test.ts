import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";

const state = vi.hoisted(() => ({
  db: undefined as unknown as DatabaseSync,
  cookies: new Map<string, string>(),
  sentEmails: [] as Array<{ to: string; token: string; kind: "verify" | "reset" }>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.cookies.has(name) ? { name, value: state.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => {
      state.cookies.set(name, value);
    },
    delete: (name: string) => {
      state.cookies.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb: () => state.db };
});

vi.mock("@/lib/email/mailer", () => ({
  sendVerificationEmail: async (to: string, token: string) => {
    state.sentEmails.push({ to, token, kind: "verify" });
  },
  sendPasswordResetEmail: async (to: string, token: string) => {
    state.sentEmails.push({ to, token, kind: "reset" });
  },
}));

const { createDatabase } = await import("@/lib/db");
const {
  registerAction,
  loginAction,
  logoutAction,
  verifyEmailAction,
  resendVerificationAction,
  resetPasswordAction,
  requestPasswordResetAction,
} = await import("@/app/actions/auth");
const { addTodoAction, toggleTodoAction, deleteTodoAction } = await import("@/app/actions/todos");
const { listTodosForUser } = await import("@/lib/repositories/todoRepository");
const { getCurrentUser } = await import("@/lib/auth/currentUser");

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

function verifyPendingUrl(email: string): string {
  return `/verify-pending?email=${encodeURIComponent(email)}`;
}

async function expectRedirectTo(promise: Promise<unknown>, url: string): Promise<void> {
  await expect(promise).rejects.toThrow(`REDIRECT:${url}`);
}

async function register(email: string, password: string): Promise<void> {
  await expectRedirectTo(
    registerAction({}, formData({ email, password })),
    verifyPendingUrl(email),
  );
}

async function registerAndVerify(email: string, password: string): Promise<void> {
  await register(email, password);
  const token = state.sentEmails.filter((e) => e.kind === "verify").at(-1)!.token;
  await verifyEmailAction({}, formData({ token }));
}

async function login(email: string, password: string): Promise<void> {
  await expectRedirectTo(loginAction({}, formData({ email, password })), "/");
}

beforeEach(() => {
  state.db = createDatabase(":memory:");
  state.cookies.clear();
  state.sentEmails.length = 0;
  process.env.SESSION_SECRET = "test-session-secret-at-least-32-characters";
});

describe("registration and login flow", () => {
  it("redirects to verify-pending on registration, blocks login until verified, then allows it after verification", async () => {
    await register("alice@example.com", "password123");

    await expectRedirectTo(
      loginAction({}, formData({ email: "alice@example.com", password: "password123" })),
      verifyPendingUrl("alice@example.com"),
    );

    const verifyToken = state.sentEmails.find((e) => e.kind === "verify")!.token;
    const verifyResult = await verifyEmailAction({}, formData({ token: verifyToken }));
    expect(verifyResult.error).toBeUndefined();

    await login("alice@example.com", "password123");
    expect(state.cookies.get("session")).toBeTruthy();
  });

  it("returns a generic error for a wrong password, never confirming which field was wrong", async () => {
    await registerAndVerify("bob@example.com", "correct-password1");

    const result = await loginAction(
      {},
      formData({ email: "bob@example.com", password: "wrong-password" }),
    );

    expect(result.error).toBe("Invalid email or password.");
  });

  it("returns the same generic error for an unknown email as for a wrong password (no enumeration via login)", async () => {
    await registerAndVerify("ivy@example.com", "correct-password1");

    const wrongPassword = await loginAction(
      {},
      formData({ email: "ivy@example.com", password: "wrong-password" }),
    );
    const unknownEmail = await loginAction(
      {},
      formData({ email: "nobody-at-all@example.com", password: "whatever1" }),
    );

    expect(wrongPassword.error).toBe(unknownEmail.error);
  });

  it("rejects an expired or unknown email-verification token", async () => {
    const result = await verifyEmailAction({}, formData({ token: "not-a-real-token" }));
    expect(result.error).toMatch(/invalid or has expired/i);
  });

  it("rejects a verification confirmation with a missing token", async () => {
    const result = await verifyEmailAction({}, formData({}));
    expect(result.error).toMatch(/missing verification token/i);
  });

  it("redirects to the same verify-pending URL whether or not the email is already registered (no enumeration via register)", async () => {
    await register("jack@example.com", "password123");
    const emailsAfterFirst = state.sentEmails.length;

    // Second registration attempt for the same email must behave identically
    // (same redirect target, asserted inside register()) — otherwise this
    // would leak whether the email was already taken.
    await register("jack@example.com", "a-different-password1");

    // No second account-creation email for an email that's already registered.
    expect(state.sentEmails.length).toBe(emailsAfterFirst);
  });
});

describe("password reset flow", () => {
  it("resets the password and invalidates every previously issued session", async () => {
    await registerAndVerify("carol@example.com", "old-password1");
    await login("carol@example.com", "old-password1");
    const oldSessionCookie = state.cookies.get("session")!;
    expect(await getCurrentUser(state.db)).not.toBeNull();

    const resetRequest = await requestPasswordResetAction(
      {},
      formData({ email: "carol@example.com" }),
    );
    expect(resetRequest.success).toMatch(/reset link/i);
    const resetToken = state.sentEmails.find((e) => e.kind === "reset")!.token;

    const resetResult = await resetPasswordAction(
      {},
      formData({ token: resetToken, password: "new-password1" }),
    );
    expect(resetResult.success).toMatch(/password updated/i);

    state.cookies.set("session", oldSessionCookie);
    expect(await getCurrentUser(state.db)).toBeNull();

    const failedOldLogin = await loginAction(
      {},
      formData({ email: "carol@example.com", password: "old-password1" }),
    );
    expect(failedOldLogin.error).toBe("Invalid email or password.");

    await login("carol@example.com", "new-password1");
  });

  it("gives the same generic response whether or not the email exists (no enumeration)", async () => {
    await registerAndVerify("dave@example.com", "password123");

    const existing = await requestPasswordResetAction({}, formData({ email: "dave@example.com" }));
    const nonExistent = await requestPasswordResetAction(
      {},
      formData({ email: "nobody@example.com" }),
    );

    expect(existing.success).toBe(nonExistent.success);
  });

  it("rejects a too-short new password", async () => {
    const result = await resetPasswordAction({}, formData({ token: "irrelevant", password: "short" }));
    expect(result.error).toMatch(/at least 8 characters/i);
  });

  it("rejects an unknown or expired reset token", async () => {
    const result = await resetPasswordAction(
      {},
      formData({ token: "not-a-real-token", password: "new-password1" }),
    );
    expect(result.error).toMatch(/invalid or has expired/i);
  });
});

describe("resend verification", () => {
  it("sends a new verification email for an existing, unverified account", async () => {
    await register("erin@example.com", "password123");
    state.sentEmails.length = 0;

    const result = await resendVerificationAction({}, formData({ email: "erin@example.com" }));

    expect(result.success).toMatch(/new link has been sent/i);
    expect(state.sentEmails).toHaveLength(1);
    expect(state.sentEmails[0].kind).toBe("verify");
  });

  it("does not send a new email for an already-verified account, but returns the same generic message", async () => {
    await registerAndVerify("frank@example.com", "password123");
    state.sentEmails.length = 0;

    const result = await resendVerificationAction({}, formData({ email: "frank@example.com" }));

    expect(result.success).toMatch(/new link has been sent/i);
    expect(state.sentEmails).toHaveLength(0);
  });
});

describe("logout", () => {
  it("clears the session cookie and redirects to /login", async () => {
    await registerAndVerify("grace@example.com", "password123");
    await login("grace@example.com", "password123");
    expect(state.cookies.get("session")).toBeTruthy();

    await expectRedirectTo(logoutAction(), "/login");

    expect(state.cookies.has("session")).toBe(false);
  });
});

describe("todo authorization", () => {
  it("scopes todos per user — one user cannot see or modify another user's todos", async () => {
    await registerAndVerify("user1@example.com", "password123");
    await login("user1@example.com", "password123");
    await addTodoAction(formData({ title: "user1 todo" }));
    const user1 = await getCurrentUser(state.db);
    const user1Todos = listTodosForUser(state.db, user1!.id);
    expect(user1Todos).toHaveLength(1);

    state.cookies.clear();
    await registerAndVerify("user2@example.com", "password123");
    await login("user2@example.com", "password123");

    await toggleTodoAction(formData({ id: String(user1Todos[0].id) }));
    await deleteTodoAction(formData({ id: String(user1Todos[0].id) }));

    const stillThere = listTodosForUser(state.db, user1!.id);
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0].completed).toBe(false);
  });

  it("ignores invalid input to the todo actions instead of throwing", async () => {
    await registerAndVerify("henry@example.com", "password123");
    await login("henry@example.com", "password123");

    await addTodoAction(formData({ title: "" }));
    await toggleTodoAction(formData({ id: "not-a-number" }));
    await deleteTodoAction(formData({ id: "not-a-number" }));

    const user = await getCurrentUser(state.db);
    expect(listTodosForUser(state.db, user!.id)).toHaveLength(0);
  });
});
