import { z } from "zod";

export const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(500),
});

export const todoIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
