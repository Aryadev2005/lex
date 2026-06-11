import { z } from 'zod';

export const contractAnalysisSchema = z.object({
  document_text: z.string().min(100, 'Contract text too short').max(50000),
});

export type ContractAnalysis = z.infer<typeof contractAnalysisSchema>;

export const redlineBodySchema = z.object({
  analysis: z.object({
    clauses: z.any(),
    research: z.any(),
    risks: z.array(z.any()).min(1, 'No risks found to include in redline'),
    overall_risk_score: z.number(),
    summary: z.string(),
  }),
});

export type RedlineBody = z.infer<typeof redlineBodySchema>;
