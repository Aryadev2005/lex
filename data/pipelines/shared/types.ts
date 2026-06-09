export interface PipelineDocument {
  id: string;
  supabase_id: string | null;
  file_path: string;
  source_url: string;
  document_type: 'judgment' | 'legislation' | 'tribunal_order';
  court: string;
  year: number;
  jurisdiction: string;
  language: string;
  status: 'downloaded' | 'extracted' | 'enriched' | 'chunked' | 'embedded' | 'error';
  error?: string;
  metadata: Record<string, unknown>;
}

export interface ExtractionResult {
  document_id: string;
  raw_text: string;
  page_count: number;
  extraction_method: 'native_pdf' | 'ocr' | 'hybrid';
  char_count: number;
  non_ascii_ratio: number;
  quality_score: number;
  language_detected: string;
}

export interface EnrichmentOutput {
  full_citation: string;
  court: string;
  year: number;
  case_number: string | null;
  parties: { petitioner: string; respondent: string };
  judges: string[];
  outcome: 'allowed' | 'dismissed' | 'modified' | 'remanded' | 'disposed' | 'unknown';
  acts_referenced: Array<{ act_name: string; sections: string[] }>;
  citations_mentioned: string[];
  legal_principles: string[];
  concept_tags: string[];
  summary: string;
  language: string;
}

export interface DocumentChunk {
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  section_path: string[];
  section_title: string;
  chunk_type: 'paragraph' | 'section_header' | 'preamble' | 'order' | 'provision';
  metadata: {
    court: string;
    year: number;
    document_type: string;
    jurisdiction: string;
    concept_tags: string[];
    acts_referenced: string[];
    full_citation: string;
  };
}

export interface EmbeddingInput {
  chunk_id: string;
  augmented_text: string;
  token_count: number;
}

export interface CheckpointEntry {
  id: string;
  status: 'success' | 'error' | 'skip';
  timestamp: string;
  error?: string;
  metadata?: Record<string, unknown>;
}
