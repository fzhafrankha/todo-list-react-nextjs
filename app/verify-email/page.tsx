import Link from "next/link";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16 text-center">
      {token ? (
        <VerifyEmailForm token={token} />
      ) : (
        <p className="text-red-600">Missing verification token.</p>
      )}
      <Link href="/login" className="mt-4 block text-sm underline">
        Back to login
      </Link>
    </main>
  );
}
