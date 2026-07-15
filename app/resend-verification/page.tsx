import Link from "next/link";
import { ResendVerificationForm } from "@/components/ResendVerificationForm";

export default function ResendVerificationPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Resend verification email</h1>
      <ResendVerificationForm />
      <Link href="/login" className="mt-4 inline-block text-sm underline">
        Back to login
      </Link>
    </main>
  );
}
