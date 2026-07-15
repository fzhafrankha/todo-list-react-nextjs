/**
 * Next.js calls `register()` once when the server process starts (App
 * Router's official hook for startup side effects: see
 * https://nextjs.org/docs/app/guides/instrumentation). Used here to start
 * the hourly sweep that deletes unverified accounts older than 24 hours.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { startExpiredAccountCleanup } = await import("@/lib/cleanup/expiredAccounts");
  startExpiredAccountCleanup();
}
