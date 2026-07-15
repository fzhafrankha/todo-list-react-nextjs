import type { Todo } from "@/lib/types";
import { TodoItem } from "@/components/TodoItem";

type Props = {
  todos: Todo[];
};

export function TodoList({ todos }: Props) {
  if (todos.length === 0) {
    return <p className="text-sm text-neutral-500">No todos yet. Add one above.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
