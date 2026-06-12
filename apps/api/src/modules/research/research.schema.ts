import { z } from 'zod';

export const DOCUMENT_TYPE_OPTIONS = [
  'supreme_court',
  'high_court',
  'district_court',
  'nclt',
  'tribunal',
  'legislation',
] as const;

export type DocumentTypeOption = (typeof DOCUMENT_TYPE_OPTIONS)[number];

export const researchQuerySchema = z.object({
  query: z.string().min(5).max(2000),
  jurisdiction: z.string().optional(),
  match_count: z.number().int().min(3).max(20).default(12),
  document_types: z
    .array(z.enum(DOCUMENT_TYPE_OPTIONS))
    .optional(),
});

export type ResearchQuery = z.infer<typeof researchQuerySchema>;
