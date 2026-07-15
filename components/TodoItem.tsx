"use client";

import type { Todo } from "@/lib/types";
import { toggleTodoAction, deleteTodoAction } from "@/app/actions/todos";

type Props = {
  todo: Todo;
};

export function TodoItem({ todo }: Props) {
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <form action={toggleTodoAction} className="flex flex-1 items-center gap-3">
        <input type="hidden" name="id" value={todo.id} />
        <button
          type="submit"
          aria-label={todo.completed ? "Mark as not done" : "Mark as done"}
          aria-pressed={todo.completed}
          className={`h-4 w-4 shrink-0 rounded border border-neutral-400 ${
            todo.completed ? "bg-neutral-900 dark:bg-white" : "bg-white dark:bg-neutral-900"
          }`}
        />
        <span
          className={
            todo.completed
              ? "text-neutral-400 line-through"
              : "text-neutral-900 dark:text-neutral-100"
          }
        >
          {todo.title}
        </span>
      </form>
      <form action={deleteTodoAction}>
        <input type="hidden" name="id" value={todo.id} />
        <button
          type="submit"
          aria-label={`Delete "${todo.title}"`}
          className="text-xs text-red-500 hover:text-red-700"
        >
          Delete
        </button>
      </form>
    </li>
  );
}
