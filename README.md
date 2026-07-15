# Todo List

A multi-user todo list built to run on **any server architecture, including arm64**, on plain Node.js — no Docker required.

## Features

- Registration redirects straight to a "verify your email" page. The verification link is valid for **15 minutes** and must be confirmed with a click on `/verify-email` — a bare page load does not consume it (see [Architecture notes](#architecture-notes))
- Logging in with an unverified account redirects to the same "verify your email" page, which has a built-in resend-link form (pre-filled with the account's email)
- Unverified accounts are **automatically deleted 24 hours** after creation (see [Architecture notes](#architecture-notes))
- Forgot / reset password via a Gmail-emailed, single-use, expiring link
- Per-user todos: add, toggle complete, delete — every todo is scoped to its owner, never visible or editable by anyone else

## Stack

- **Next.js** (App Router) — the only framework needed; it includes React, so there is no separate Vite build
- **SQLite via `node:sqlite`** — Node's built-in SQLite module (Node 22.5+, stabilized in Node 26). No native compilation, so there's no per-architecture prebuild risk the way `better-sqlite3`/`sqlite3` have
- **Auth** — custom session/password handling built on `node:crypto` only (scrypt password hashing, HMAC-signed session cookies). No auth library, so no extra dependency tree to audit for native bindings
- **Email** — Gmail SMTP via `nodemailer` (pure JS, zero native dependencies) in production; [Mailpit](https://mailpit.axllent.org/) locally in development (see below), used for email verification and password reset

## Requirements

- Node.js **>= 22.5.0** (see `engines` in `package.json`)
- For production (`MAIL_PROVIDER=gmail`): a Gmail account with 2FA enabled and an [App Password](https://support.google.com/accounts/answer/185833) generated for it
- For local development (`MAIL_PROVIDER=mailpit`): [Mailpit](https://mailpit.axllent.org/) running locally — see [Local email testing with Mailpit](#mailpit)

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

| Variable | Notes |
|---|---|
| `SESSION_SECRET` | Random string, 32+ chars. Generate with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` |
| `APP_URL` | Public base URL, used to build verification/reset email links |
| `MAIL_PROVIDER` | `gmail` (default) or `mailpit` — see [Local email testing with Mailpit](#mailpit) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Required when `MAIL_PROVIDER=gmail` — `GMAIL_APP_PASSWORD` must be an App Password, never the real account password |
| `SMTP_HOST` / `SMTP_PORT` | Used when `MAIL_PROVIDER=mailpit`. Default to Mailpit's own defaults (`localhost:1025`) |
| `DATABASE_PATH` | Where the SQLite file lives. Defaults to `./data/todos.db` |

```bash
npm run dev
```

### Local email testing with Mailpit<a id="mailpit"></a>

For local development, set `MAIL_PROVIDER=mailpit` in `.env` instead of configuring real Gmail credentials. [Mailpit](https://mailpit.axllent.org/) is a local SMTP server that captures every email sent by the app instead of delivering it, and shows them in a web UI — no real inbox, no risk of emailing a real person while testing.

Mailpit ships as a single, dependency-free binary with builds for every architecture this app targets (including arm64), so it fits the same "no Docker, runs anywhere Node does" philosophy as the rest of the stack — it's just a separate local process, not part of the app itself.

```bash
# Install (see https://mailpit.axllent.org/docs/install/ for other options)
go install github.com/axllent/mailpit@latest
# or on macOS: brew install mailpit

# Run it (defaults: SMTP on :1025, web UI on :8025)
mailpit
```

Then set in `.env`:

```
MAIL_PROVIDER=mailpit
```

Open `http://localhost:8025` to see verification and password-reset emails as the app sends them. `SMTP_HOST`/`SMTP_PORT` only need to be set if Mailpit isn't running on its defaults.

### A note on `DATABASE_PATH`

SQLite's file locking assumes a POSIX-compliant filesystem. Point `DATABASE_PATH` at a **native filesystem** (ext4, xfs, etc.) — avoid NTFS/exFAT mounts, FUSE mounts, and network drives/shares, where SQLite can intermittently fail with `attempt to write a readonly database` under concurrent access. This was hit and confirmed during development on an NTFS-mounted drive; moving the DB file to a native filesystem resolved it immediately.

## Scripts

```bash
npm run dev          # dev server
npm run build         # production build
npm run start         # run the production build
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # unit + integration tests (Vitest)
npm run test:coverage  # tests with coverage report
npm run test:e2e       # Playwright E2E (spins up its own dev server)
```

## Architecture notes<a id="architecture-notes"></a>

- **Repository pattern** (`lib/repositories/`) isolates all SQLite access behind plain functions, so the driver could be swapped later without touching business logic.
- **Auth tokens** (email verification, password reset) share one `auth_tokens` table, scoped by `purpose` — a token issued for one purpose can never be replayed for another.
- **Sessions are stateless**, HMAC-signed cookies carrying a `tokenVersion`. A password reset bumps the user's `tokenVersion` in the DB, which instantly invalidates every previously issued session without needing a server-side session store.
- `proxy.ts` (Next.js 16's replacement for `middleware.ts`) does a fast, DB-free redirect for unauthenticated requests to protected routes. It only checks the session's signature and expiry — the authoritative check (including revocation via `tokenVersion`) happens in Server Components/Actions via `lib/auth/currentUser.ts`.
- Content-Security-Policy uses `'unsafe-inline'` on `script-src`, a deliberate tradeoff: a stricter per-request nonce CSP was tried and reverted because Next.js 16 + Turbopack does not thread the nonce into statically prerendered pages' `<script>` tags, which broke hydration entirely on those routes. See the comment in `next.config.ts`.
- `MAIL_PROVIDER` (`lib/email/mailer.ts`) picks the SMTP transport at runtime — `gmail` for production, `mailpit` for manual local testing against a real (if local) SMTP flow. This is distinct from `E2E_TEST_MODE` below, which bypasses SMTP entirely for automated tests.
- `E2E_TEST_MODE=true` swaps real Gmail sending for an append-only local log file (`lib/email/mailer.ts`), so Playwright can read verification/reset links without real Gmail credentials or network access. It never adds an HTTP route or other runtime attack surface.
- `instrumentation.ts` (Next.js's official startup hook) starts an hourly sweep (`lib/cleanup/expiredAccounts.ts`) that deletes unverified accounts older than 24 hours; `ON DELETE CASCADE` in the schema removes their todos and tokens along with them. This assumes a single, long-running Node.js process — the same assumption the in-memory rate limiter already makes — rather than a serverless/edge deployment.
