import { Tiktoken } from 'tiktoken/lite';
import cl100k from 'tiktoken/encoders/cl100k_base';
import type { DocumentChunk } from '../shared/types.js';

const encoder = new Tiktoken(cl100k.bpe_ranks, cl100k.special_tokens, cl100k.pat_str);

const MAX_EMBEDDING_TOKENS = 8000;

/**
 * Builds the metadata-augmented text used as the embedding input.
 *
 * Format: {court} | {year} | {doc_type} | {citation} | {section_path} | {content}
 *
 * Why: embedding court authority, year, citation, and section hierarchy alongside
 * the content makes retrieval dramatically more precise — the model can match
 * "Supreme Court 2019 Article 370" without those words appearing in the chunk.
 */
export function buildAugmentedText(chunk: DocumentChunk): string {
  const m = chunk.metadata;
  const sectionPath = chunk.section_path.join(' > ');

  const prefix = [m.court, String(m.year), m.document_type, m.full_citation, sectionPath].join(
    ' | ',
  );

  const prefixToks = encoder.encode_ordinary(prefix + ' | ').length;
  const available = MAX_EMBEDDING_TOKENS - prefixToks;

  let content = chunk.content;
  const contentEncoded = encoder.encode_ordinary(content);

  if (contentEncoded.length > available && available > 0) {
    const truncated = encoder.decode(contentEncoded.slice(0, available));
    content = new TextDecoder().decode(truncated) + '...';
  }

  return `${prefix} | ${content}`;
}
