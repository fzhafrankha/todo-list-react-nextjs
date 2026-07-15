"use client";

import { useActionState } from "react";
import Link from "next/link";
import { verifyEmailAction, type ActionState } from "@/app/actions/auth";

type Props = {
  token: string;
};

const initialState: ActionState = {};

export function VerifyEmailForm({ token }: Props) {
  const [state, formAction, pending] = useActionState(verifyEmailAction, initialState);

  if (state.success) {
    return <p className="text-green-600">{state.success}</p>;
  }

  return (
    <form action={formAction} className="flex flex-col items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Click below to confirm your email address.
      </p>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Verifying..." : "Verify my email"}
      </button>
      {state.error && (
        <Link href="/resend-verification" className="text-sm underline">
          Request a new link
        </Link>
      )}
    </form>
  );
}
