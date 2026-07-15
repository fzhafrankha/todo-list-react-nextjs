"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createTodo, toggleTodo, deleteTodo } from "@/lib/repositories/todoRepository";
import { createTodoSchema, todoIdSchema } from "@/lib/schemas/todo";

export async function addTodoAction(formData: FormData): Promise<void> {
  const db = getDb();
  const user = await requireCurrentUser(db);

  const parsed = createTodoSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    return;
  }

  createTodo(db, user.id, parsed.data.title);
  revalidatePath("/");
}

export async function toggleTodoAction(formData: FormData): Promise<void> {
  const db = getDb();
  const user = await requireCurrentUser(db);

  const parsed = todoIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return;
  }

  toggleTodo(db, user.id, parsed.data.id);
  revalidatePath("/");
}

export async function deleteTodoAction(formData: FormData): Promise<void> {
  const db = getDb();
  const user = await requireCurrentUser(db);

  const parsed = todoIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return;
  }

  deleteTodo(db, user.id, parsed.data.id);
  revalidatePath("/");
}
