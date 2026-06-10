import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import OpenAI from 'openai';
import { hybridSearch } from '../../lib/rag.js';
import type {
  ExtractedClause,
  ClauseResearch,
  RiskItem,
  ContractSSEEvent,
  ContractAnalysisResult,
} from './contract.types.js';

const ContractState = Annotation.Root({
  documentText: Annotation<string>,
  clauses: Annotation<ExtractedClause[]>({
    reducer: (_a: ExtractedClause[], b: ExtractedClause[]) => b,
    default: () => [],
  }),
  researchMap: Annotation<Record<string, ClauseResearch>>({
    reducer: (a: Record<string, ClauseResearch>, b: Record<string, ClauseResearch>) => ({ ...a, ...b }),
    default: () => ({}),
  }),
  risks: Annotation<RiskItem[]>({
    reducer: (_a: RiskItem[], b: RiskItem[]) => b,
    default: () => [],
  }),
  onEvent: Annotation<(e: ContractSSEEvent) => void>({
    reducer: (_a: (e: ContractSSEEvent) => void, b: (e: ContractSSEEvent) => void) => b,
    default: () => () => {},
  }),
  supabase: Annotation<any>({ reducer: (_a: any, b: any) => b, default: () => null }),
  openai: Annotation<OpenAI>({ reducer: (_a: OpenAI, b: OpenAI) => b, default: () => ({} as OpenAI) }),
});

async function extractorNode(state: typeof ContractState.State) {
  state.onEvent({
    type: 'progress',
    agent: 'extractor',
    message: 'Identifying and categorising contract clauses…',
    progress: 10,
  });

  const apiKey = (state.openai as any).apiKey as string;
  const llm = new ChatOpenAI({ model: 'gpt-4o', apiKey });

  let parsed: ExtractedClause[] = [];
  try {
    const response = await llm.invoke([
      [
        'system',
        'You are a contract analysis AI. Extract all significant clauses from the contract. For each clause return: id (clause_N), type (choose from: indemnity, limitation_of_liability, termination, payment, intellectual_property, confidentiality, governing_law, dispute_resolution, warranties, force_majeure, assignment, penalty, other), title, content, index (0-based position). Return ONLY valid JSON array.',
      ],
      ['human', `Extract all clauses from this contract:\n\n${state.documentText}`],
    ]);
    parsed = JSON.parse(response.content as string) as ExtractedClause[];
  } catch {
    // malformed JSON or invocation error — return empty clauses
  }

  state.onEvent({ type: 'clauses', clauses: parsed });
  return { clauses: parsed };
}

async function researcherNode(state: typeof ContractState.State) {
  state.onEvent({
    type: 'progress',
    agent: 'researcher',
    message: `Researching ${state.clauses.length} clauses against Indian law…`,
    progress: 30,
  });

  const researchMap: Record<string, ClauseResearch> = {};

  for (const clause of state.clauses) {
    const query = `Indian law on ${clause.type} clauses: ${clause.title}`;
    const chunks = await hybridSearch(state.supabase, state.openai, query, 5);
    const filtered = chunks.filter((c) => c.vector_score >= 0.40);

    const research: ClauseResearch = {
      clause_id: clause.id,
      relevant_law:
        filtered.length > 0
          ? filtered
              .slice(0, 2)
              .map((c) => c.content.slice(0, 300))
              .join(' | ')
          : 'No specific Indian precedent found',
      sources: filtered
        .slice(0, 3)
        .map((c) => c.citation)
        .filter(Boolean),
      found_grounded: filtered.length > 0,
    };

    state.onEvent({ type: 'research_update', clause_id: clause.id, found: filtered.length > 0 });
    researchMap[clause.id] = research;
  }

  return { researchMap };
}

async function analyzerNode(state: typeof ContractState.State) {
  state.onEvent({
    type: 'progress',
    agent: 'analyzer',
    message: 'Analysing risk levels and generating recommendations…',
    progress: 70,
  });

  const apiKey = (state.openai as any).apiKey as string;
  const llm = new ChatOpenAI({ model: 'gpt-4o', apiKey });

  const userMessage = state.clauses
    .map((c) => {
      const r = state.researchMap[c.id];
      return `Clause ${c.id} [${c.type}]: ${c.title}\nContent: ${c.content}\nRelevant law: ${r?.relevant_law ?? 'none'}\nSources: ${r?.sources?.join(', ') ?? 'none'}`;
    })
    .join('\n\n---\n\n');

  let risks: RiskItem[] = [];

  try {
    const response = await llm.invoke([
      [
        'system',
        "You are a senior Indian contract lawyer. Analyse each clause for legal risk under Indian law. For each clause produce:\n- risk_level: 'low', 'medium', 'high', or 'critical'\n- risk_explanation: plain-English explanation of the risk (2-3 sentences)\n- legal_basis: the relevant Indian law/principle (cite Act and section if known)\n- legal_citations: array of case citations from research (can be empty)\n- suggested_alternative: a concrete redraft of the clause (2-4 sentences)\nReturn ONLY a valid JSON array of risk items. No preamble.",
      ],
      ['human', userMessage],
    ]);

    const rawRisks = JSON.parse(response.content as string) as any[];

    risks = rawRisks.map((r) => {
      const clause = state.clauses.find((c) => c.id === r.clause_id);
      return {
        clause_id: r.clause_id as string,
        clause_type: clause?.type ?? (r.clause_type as string | undefined) ?? '',
        clause_title: clause?.title ?? (r.clause_title as string | undefined) ?? '',
        clause_content: clause?.content ?? (r.clause_content as string | undefined) ?? '',
        risk_level: r.risk_level as RiskItem['risk_level'],
        risk_explanation: r.risk_explanation as string,
        legal_basis: r.legal_basis as string,
        legal_citations: (r.legal_citations as string[] | undefined) ?? [],
        suggested_alternative: r.suggested_alternative as string,
      };
    });
  } catch {
    // parse error — continue with empty risks
  }

  for (const risk of risks) {
    state.onEvent({ type: 'risk_update', risk });
  }

  const riskWeights: Record<string, number> = { low: 10, medium: 30, high: 60, critical: 90 };
  const score = risks.reduce((sum, r) => sum + (riskWeights[r.risk_level] ?? 0), 0);
  const overall_risk_score =
    risks.length > 0 ? Math.min(100, Math.round(score / risks.length)) : 0;

  let summary: string;
  if (overall_risk_score >= 70) {
    summary =
      'This contract contains critical or high-risk clauses requiring immediate legal review before signing.';
  } else if (overall_risk_score >= 40) {
    summary =
      'This contract has moderate risk. Several clauses need negotiation or revision before execution.';
  } else {
    summary =
      'This contract is relatively low risk. Minor revisions may improve fairness and enforceability.';
  }

  const analysis: ContractAnalysisResult = {
    clauses: state.clauses,
    research: Object.values(state.researchMap),
    risks,
    overall_risk_score,
    summary,
  };

  state.onEvent({ type: 'result', analysis });

  return { risks };
}

export const contractGraph = new StateGraph(ContractState)
  .addNode('extractor', extractorNode)
  .addNode('researcher', researcherNode)
  .addNode('analyzer', analyzerNode)
  .addEdge(START, 'extractor')
  .addEdge('extractor', 'researcher')
  .addEdge('researcher', 'analyzer')
  .addEdge('analyzer', END)
  .compile();
