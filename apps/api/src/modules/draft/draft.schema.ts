import { z } from 'zod';

export const draftGenerateSchema = z.object({
  template_id: z.string(),
  situation_description: z.string().min(20).max(5000),
  additional_facts: z.record(z.string()).optional(),
});

export type DraftGenerate = z.infer<typeof draftGenerateSchema>;
