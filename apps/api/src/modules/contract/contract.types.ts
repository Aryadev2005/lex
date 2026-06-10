export interface ExtractedClause {
  id: string;
  type: string;
  title: string;
  content: string;
  index: number;
}

export interface ClauseResearch {
  clause_id: string;
  relevant_law: string;
  sources: string[];
  found_grounded: boolean;
}

export interface RiskItem {
  clause_id: string;
  clause_type: string;
  clause_title: string;
  clause_content: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_explanation: string;
  legal_basis: string;
  legal_citations: string[];
  suggested_alternative: string;
}

export interface ContractAnalysisResult {
  clauses: ExtractedClause[];
  research: ClauseResearch[];
  risks: RiskItem[];
  overall_risk_score: number;
  summary: string;
}

export type ContractSSEEvent =
  | { type: 'progress'; agent: 'extractor' | 'researcher' | 'analyzer'; message: string; progress: number }
  | { type: 'clauses'; clauses: ExtractedClause[] }
  | { type: 'research_update'; clause_id: string; found: boolean }
  | { type: 'risk_update'; risk: RiskItem }
  | { type: 'result'; analysis: ContractAnalysisResult }
  | { type: 'error'; message: string };
