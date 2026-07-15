import nodemailer, { type Transporter } from "nodemailer";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

type MailProvider = "gmail" | "mailpit";

function getMailProvider(): MailProvider {
  const provider = process.env.MAIL_PROVIDER ?? "gmail";
  if (provider !== "gmail" && provider !== "mailpit") {
    throw new Error(`Unknown MAIL_PROVIDER "${provider}". Use "gmail" or "mailpit".`);
  }
  return provider;
}

function getGmailCredentials(): { user: string; pass: string } {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD environment variables must be set when MAIL_PROVIDER=gmail. " +
        "GMAIL_APP_PASSWORD must be a Gmail App Password (requires 2FA on the account), not the account password.",
    );
  }
  return { user, pass };
}

/**
 * The address emails appear to come "from". Gmail requires this to match
 * the authenticated account; Mailpit doesn't validate it at all (it's a
 * local dev SMTP catcher — see README), so a fixed placeholder is fine
 * there unless MAIL_FROM is set explicitly.
 */
function getFromAddress(): string {
  if (process.env.MAIL_FROM) {
    return process.env.MAIL_FROM;
  }
  if (getMailProvider() === "gmail") {
    return getGmailCredentials().user;
  }
  return "Todo List <dev@localhost>";
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
  if (transporter) {
    return transporter;
  }

  if (getMailProvider() === "mailpit") {
    // Mailpit (https://mailpit.axllent.org/): a local SMTP catcher for dev —
    // no auth, no TLS, and nothing ever leaves the machine. View captured
    // mail at http://localhost:8025. See the README for setup.
    const host = process.env.SMTP_HOST ?? "localhost";
    const port = Number(process.env.SMTP_PORT ?? "1025");
    transporter = nodemailer.createTransport({ host, port, secure: false });
    return transporter;
  }

  const { user, pass } = getGmailCredentials();
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

/**
 * E2E_TEST_MODE swaps real sending for an append-only local log file, so
 * Playwright can read the link without any SMTP server (Gmail or Mailpit)
 * running. It never adds an HTTP route or any other runtime attack surface —
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

  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject,
    text: `Confirm your email by visiting: ${link}\n\nThis link expires in 15 minutes.`,
    html: `<p>Confirm your email by clicking the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your password";

  if (isE2ETestMode()) {
    logForE2E(to, subject, link);
    return;
  }

  await getTransporter().sendMail({
    from: getFromAddress(),
    to,
    subject,
    text: `Reset your password by visiting: ${link}\n\nThis link expires in 30 minutes. If you didn't request this, ignore this email.`,
    html: `<p>Reset your password by clicking the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 30 minutes. If you didn't request this, ignore this email.</p>`,
  });
}
