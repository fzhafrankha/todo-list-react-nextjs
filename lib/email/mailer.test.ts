import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface SentMail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const sendMailMock = vi.fn<(options: SentMail) => Promise<Record<string, never>>>(
  async () => ({}),
);

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
  },
}));

const { sendVerificationEmail, sendPasswordResetEmail } = await import("@/lib/email/mailer");

const originalEnv = { ...process.env };

beforeEach(() => {
  sendMailMock.mockClear();
  process.env.APP_URL = "https://example.com";
  process.env.GMAIL_USER = "bot@example.com";
  process.env.GMAIL_APP_PASSWORD = "app-password";
  delete process.env.E2E_TEST_MODE;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("sendVerificationEmail / sendPasswordResetEmail", () => {
  it("sends a verification email with a link built from APP_URL and the token", async () => {
    await sendVerificationEmail("user@example.com", "tok123");

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.html).toContain("https://example.com/verify-email?token=tok123");
  });

  it("sends a password reset email with a link built from APP_URL and the token", async () => {
    await sendPasswordResetEmail("user@example.com", "tok456");

    const call = sendMailMock.mock.calls[0][0];
    expect(call.html).toContain("https://example.com/reset-password?token=tok456");
  });

  it("throws a clear error when Gmail credentials are missing", async () => {
    delete process.env.GMAIL_USER;

    await expect(sendVerificationEmail("user@example.com", "tok")).rejects.toThrow(/GMAIL_USER/);
  });

  it("throws a clear error when APP_URL is missing", async () => {
    delete process.env.APP_URL;

    await expect(sendVerificationEmail("user@example.com", "tok")).rejects.toThrow(/APP_URL/);
  });
});

describe("E2E_TEST_MODE", () => {
  it("logs to a local file instead of calling Gmail", async () => {
    const logPath = join(mkdtempSync(join(tmpdir(), "mailer-e2e-")), "mail.log");
    process.env.E2E_TEST_MODE = "true";
    process.env.E2E_MAIL_LOG_PATH = logPath;

    await sendVerificationEmail("user@example.com", "tok789");

    expect(sendMailMock).not.toHaveBeenCalled();
    const contents = readFileSync(logPath, "utf8");
    expect(contents).toContain("user@example.com");
    expect(contents).toContain("tok789");

    rmSync(join(logPath, ".."), { recursive: true, force: true });
  });
});
