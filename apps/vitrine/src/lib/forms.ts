import { z } from 'zod';

/**
 * Tiny zod bridge for react-hook-form submit handlers — validates values and
 * returns a flat `{ field: message }` map, avoiding the resolvers package.
 */
export function validateWith<S extends z.ZodTypeAny>(
  schema: S,
  values: unknown,
): { success: true; data: z.infer<S> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'root';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
