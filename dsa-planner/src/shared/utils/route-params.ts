import { z } from "zod";
import { KNOWLEDGE_KINDS } from "@/domain/entities/KnowledgeItem";
export const parseIdParam = async (
  params: Promise<{ id: string }>,
): Promise<string> =>
  z
    .string()
    .uuid("Invalid id")
    .parse((await params).id);
export const knowledgeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => value || undefined),
  kind: z.enum(KNOWLEDGE_KINDS).optional(),
  topic: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(60)
    .optional(),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
export const factActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("reject") }),
  z.object({
    action: z.literal("edit"),
    value: z
      .unknown()
      .refine(
        (value) => value !== null && value !== undefined,
        "Give a value.",
      ),
  }),
]);
