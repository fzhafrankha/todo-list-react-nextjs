import Link from "next/link";
import { ResendVerificationForm } from "@/components/ResendVerificationForm";

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyPendingPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-4 text-2xl font-semibold">Verify your email</h1>
      <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        {email ? (
          <>
            We sent a verification link to <span className="font-medium">{email}</span>.
          </>
        ) : (
          "Check your inbox for a verification link."
        )}{" "}
        You need to verify your email before you can log in. The link is valid for 15 minutes,
        and unverified accounts are automatically deleted after 24 hours.
      </p>
      <ResendVerificationForm defaultEmail={email} />
      <Link href="/login" className="mt-4 inline-block text-sm underline">
        Back to login
      </Link>
    </main>
  );
}
