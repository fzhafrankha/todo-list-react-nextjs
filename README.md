# Todo List

A multi-user todo list built to run on **any server architecture, including arm64**, on plain Node.js — no Docker required.

## Features

- Registration with required email verification before first login (confirmed via a click on `/verify-email`, not a bare page load — see [Architecture notes](#architecture-notes))
- Login / logout, with a resend-verification page for accounts that never received or lost their link
- Forgot / reset password via a Gmail-emailed, single-use, expiring link
- Per-user todos: add, toggle complete, delete — every todo is scoped to its owner, never visible or editable by anyone else

## Stack

- **Next.js** (App Router) — the only framework needed; it includes React, so there is no separate Vite build
- **SQLite via `node:sqlite`** — Node's built-in SQLite module (Node 22.5+, stabilized in Node 26). No native compilation, so there's no per-architecture prebuild risk the way `better-sqlite3`/`sqlite3` have
- **Auth** — custom session/password handling built on `node:crypto` only (scrypt password hashing, HMAC-signed session cookies). No auth library, so no extra dependency tree to audit for native bindings
- **Email** — Gmail SMTP via `nodemailer` (pure JS, zero native dependencies), used for email verification and password reset

## Requirements

- Node.js **>= 22.5.0** (see `engines` in `package.json`)
- A Gmail account with 2FA enabled and an [App Password](https://support.google.com/accounts/answer/185833) generated for it

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
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail SMTP sender — `GMAIL_APP_PASSWORD` must be an App Password, never the real account password |
| `DATABASE_PATH` | Where the SQLite file lives. Defaults to `./data/todos.db` |

```bash
npm run dev
```

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
- `E2E_TEST_MODE=true` swaps real Gmail sending for an append-only local log file (`lib/email/mailer.ts`), so Playwright can read verification/reset links without real Gmail credentials or network access. It never adds an HTTP route or other runtime attack surface.
