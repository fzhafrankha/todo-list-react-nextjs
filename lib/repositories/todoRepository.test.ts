import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createDatabase } from "@/lib/db";
import { createUser } from "@/lib/repositories/userRepository";
import {
  createTodo,
  listTodosForUser,
  toggleTodo,
  deleteTodo,
} from "@/lib/repositories/todoRepository";

describe("todoRepository", () => {
  let db: DatabaseSync;
  let userId: number;
  let otherUserId: number;

  beforeEach(() => {
    db = createDatabase(":memory:");
    userId = createUser(db, { email: "owner@example.com", passwordHash: "h", passwordSalt: "s" }).id;
    otherUserId = createUser(db, { email: "other@example.com", passwordHash: "h", passwordSalt: "s" }).id;
  });

  it("creates a todo owned by the given user, incomplete by default", () => {
    const todo = createTodo(db, userId, "Buy milk");

    expect(todo.userId).toBe(userId);
    expect(todo.title).toBe("Buy milk");
    expect(todo.completed).toBe(false);
  });

  it("lists only the requesting user's todos, oldest first", () => {
    createTodo(db, userId, "first");
    createTodo(db, userId, "second");
    createTodo(db, otherUserId, "someone else's todo");

    const todos = listTodosForUser(db, userId);

    expect(todos.map((t) => t.title)).toEqual(["first", "second"]);
  });

  it("toggles a todo's completed state", () => {
    const todo = createTodo(db, userId, "toggle me");

    const toggledOn = toggleTodo(db, userId, todo.id);
    expect(toggledOn?.completed).toBe(true);

    const toggledOff = toggleTodo(db, userId, todo.id);
    expect(toggledOff?.completed).toBe(false);
  });

  it("does not toggle another user's todo", () => {
    const todo = createTodo(db, userId, "protected");

    const result = toggleTodo(db, otherUserId, todo.id);

    expect(result).toBeUndefined();
    expect(listTodosForUser(db, userId)[0].completed).toBe(false);
  });

  it("deletes a todo only for its owner", () => {
    const todo = createTodo(db, userId, "to delete");

    const deletedByOther = deleteTodo(db, otherUserId, todo.id);
    expect(deletedByOther).toBe(false);
    expect(listTodosForUser(db, userId)).toHaveLength(1);

    const deletedByOwner = deleteTodo(db, userId, todo.id);
    expect(deletedByOwner).toBe(true);
    expect(listTodosForUser(db, userId)).toHaveLength(0);
  });
});
