import { z } from 'zod';

export const researchQuerySchema = z.object({
  query: z.string().min(5).max(2000),
  jurisdiction: z.string().optional(),
  match_count: z.number().int().min(3).max(20).default(12),
});

export type ResearchQuery = z.infer<typeof researchQuerySchema>;
