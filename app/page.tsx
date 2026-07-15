import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { listTodosForUser } from "@/lib/repositories/todoRepository";
import { AddTodoForm } from "@/components/AddTodoForm";
import { TodoList } from "@/components/TodoList";
import { logoutAction } from "@/app/actions/auth";

export default async function HomePage() {
  const db = getDb();
  const user = await getCurrentUser(db);
  if (!user) {
    redirect("/login");
  }

  const todos = listTodosForUser(db, user.id);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your Todos</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            Log out
          </button>
        </form>
      </div>
      <AddTodoForm />
      <TodoList todos={todos} />
    </main>
  );
}
