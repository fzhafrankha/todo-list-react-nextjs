"use client";

import { useRef } from "react";
import { addTodoAction } from "@/app/actions/todos";

export function AddTodoForm() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await addTodoAction(formData);
        formRef.current?.reset();
      }}
      className="mb-6 flex gap-2"
    >
      <input
        name="title"
        type="text"
        required
        maxLength={500}
        placeholder="What needs doing?"
        className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        Add
      </button>
    </form>
  );
}
