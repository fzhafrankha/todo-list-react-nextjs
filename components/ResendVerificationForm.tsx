"use client";

import { useActionState } from "react";
import { resendVerificationAction, type ActionState } from "@/app/actions/auth";

type Props = {
  defaultEmail?: string;
};

const initialState: ActionState = {};

export function ResendVerificationForm({ defaultEmail }: Props) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="email"
        type="email"
        required
        defaultValue={defaultEmail}
        placeholder="Email"
        className="rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Sending..." : "Resend verification link"}
      </button>
    </form>
  );
}
