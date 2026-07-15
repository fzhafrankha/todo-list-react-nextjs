import type { DatabaseSync } from "node:sqlite";
import type { Todo } from "@/lib/types";

interface TodoRow {
  id: number;
  user_id: number;
  title: string;
  completed: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: TodoRow): Todo {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    completed: row.completed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTodosForUser(db: DatabaseSync, userId: number): Todo[] {
  const rows = db
    .prepare(`SELECT * FROM todos WHERE user_id = ? ORDER BY created_at ASC`)
    .all(userId) as unknown as TodoRow[];
  return rows.map(mapRow);
}

export function createTodo(db: DatabaseSync, userId: number, title: string): Todo {
  const row = db
    .prepare(
      `INSERT INTO todos (user_id, title) VALUES (?, ?) RETURNING *`,
    )
    .get(userId, title) as unknown as TodoRow;
  return mapRow(row);
}

/** Scoped to `userId` in the WHERE clause — a user can never toggle another user's todo. */
export function toggleTodo(db: DatabaseSync, userId: number, todoId: number): Todo | undefined {
  const row = db
    .prepare(
      `UPDATE todos
       SET completed = CASE completed WHEN 1 THEN 0 ELSE 1 END,
           updated_at = datetime('now')
       WHERE id = ? AND user_id = ?
       RETURNING *`,
    )
    .get(todoId, userId) as unknown as TodoRow | undefined;
  return row ? mapRow(row) : undefined;
}

/** Scoped to `userId` in the WHERE clause — a user can never delete another user's todo. */
export function deleteTodo(db: DatabaseSync, userId: number, todoId: number): boolean {
  const result = db.prepare(`DELETE FROM todos WHERE id = ? AND user_id = ?`).run(
    todoId,
    userId,
  );
  return result.changes > 0;
}
