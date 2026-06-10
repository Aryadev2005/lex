import { z } from 'zod';

export const contractAnalysisSchema = z.object({
  document_text: z.string().min(100, 'Contract text too short').max(50000),
});

export type ContractAnalysis = z.infer<typeof contractAnalysisSchema>;
