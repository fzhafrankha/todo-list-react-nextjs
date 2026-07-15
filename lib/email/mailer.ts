import nodemailer, { type Transporter } from "nodemailer";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function getCredentials(): { user: string; pass: string } {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD environment variables must be set to send email. " +
        "GMAIL_APP_PASSWORD must be a Gmail App Password (requires 2FA on the account), not the account password.",
    );
  }
  return { user, pass };
}

function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error("APP_URL environment variable must be set to build email links.");
  }
  return url;
}

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const { user, pass } = getCredentials();
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

/**
 * E2E_TEST_MODE swaps real Gmail sending for an append-only local log file,
 * so Playwright can read the link without real Gmail credentials or network
 * access. It never adds an HTTP route or any other runtime attack surface —
 * it only changes what this module does internally, and only when an
 * operator explicitly sets the env var (never on by default).
 */
function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === "true";
}

function logForE2E(to: string, subject: string, link: string): void {
  const path = process.env.E2E_MAIL_LOG_PATH ?? "./data/e2e-mail.log";
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ to, subject, link })}\n`);
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const subject = "Verify your email";

  if (isE2ETestMode()) {
    logForE2E(to, subject, link);
    return;
  }

  const { user } = getCredentials();
  await getTransporter().sendMail({
    from: user,
    to,
    subject,
    text: `Confirm your email by visiting: ${link}\n\nThis link expires in 30 minutes.`,
    html: `<p>Confirm your email by clicking the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your password";

  if (isE2ETestMode()) {
    logForE2E(to, subject, link);
    return;
  }

  const { user } = getCredentials();
  await getTransporter().sendMail({
    from: user,
    to,
    subject,
    text: `Reset your password by visiting: ${link}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`,
    html: `<p>Reset your password by clicking the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
  });
}
