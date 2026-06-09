import { Tiktoken } from 'tiktoken/lite';
import cl100k from 'tiktoken/encoders/cl100k_base';
import type { SectionNode } from './tree.js';
import type { DocumentChunk } from '../shared/types.js';

// Single encoder instance reused across all calls — creating/destroying WASM per
// document is expensive. Never call .free() so it lives for the process lifetime.
const encoder = new Tiktoken(cl100k.bpe_ranks, cl100k.special_tokens, cl100k.pat_str);

export interface Chunk {
  content: string;
  token_count: number;
  section_node: SectionNode;
  chunk_index_within_section: number;
  is_first_in_section: boolean;
  is_last_in_section: boolean;
}

function countTokens(text: string): number {
  return encoder.encode_ordinary(text).length;
}

function decodeTokens(tokens: Uint32Array): string {
  return new TextDecoder().decode(encoder.decode(tokens));
}

// Split text into units for greedy packing.
// Tries paragraphs first, then sentences, then raw string as fallback.
function intoUnits(text: string): string[] {
  const paras = text.split(/\n{2,}/).filter(p => p.trim().length > 0);
  if (paras.length === 0) return [text];

  const units: string[] = [];
  for (const para of paras) {
    // Sentences are fine-grained units — split only if a paragraph is very large
    const paraText = para + '\n\n';
    if (countTokens(paraText) <= 450) {
      units.push(paraText);
    } else {
      // Split by sentence boundaries
      const sentences = para.split(/(?<=[.!?।])\s+/);
      for (const s of sentences) {
        if (s.trim().length > 0) units.push(s.trim() + ' ');
      }
    }
  }
  return units.length > 0 ? units : [text];
}

export function splitSectionIntoChunks(
  section: SectionNode,
  maxTokens = 350,
  overlapTokens = 50,
): Chunk[] {
  // Prepend section title as context inside each chunk when it's meaningful
  const headerPrefix =
    section.title.trim().length > 4 ? `[${section.title.trim()}]\n` : '';
  const headerToks = countTokens(headerPrefix);

  // Budget: max content tokens per chunk (header + overlap leave the rest)
  const budget = maxTokens - headerToks - overlapTokens;

  const docTokenCount = countTokens(section.text);

  if (docTokenCount <= maxTokens - headerToks) {
    const content = (headerPrefix + section.text).trim();
    return [
      {
        content,
        token_count: countTokens(content),
        section_node: section,
        chunk_index_within_section: 0,
        is_first_in_section: true,
        is_last_in_section: true,
      },
    ];
  }

  const units = intoUnits(section.text);
  const chunks: Chunk[] = [];

  let currentUnits: string[] = [];
  let currentToks = 0;
  let overlapText = '';

  const flush = (): void => {
    if (currentUnits.length === 0) return;

    const raw = currentUnits.join('');
    const withOverlap = overlapText ? `...${overlapText}\n${raw}` : raw;
    const content = (headerPrefix + withOverlap).trim();

    chunks.push({
      content,
      token_count: countTokens(content),
      section_node: section,
      chunk_index_within_section: chunks.length,
      is_first_in_section: chunks.length === 0,
      is_last_in_section: false,
    });

    // Overlap = last overlapTokens worth of the freshly-added content (no carry-over)
    const rawEncoded = encoder.encode_ordinary(raw);
    if (rawEncoded.length > overlapTokens) {
      overlapText = decodeTokens(rawEncoded.slice(rawEncoded.length - overlapTokens)).trim();
    } else {
      overlapText = raw.trim();
    }

    currentUnits = [];
    currentToks = 0;
  };

  for (const unit of units) {
    const unitToks = countTokens(unit);

    if (unitToks > budget) {
      // Oversized unit: word-level fallback
      const words = unit.split(/\s+/).filter(Boolean);
      for (const word of words) {
        const wordToks = countTokens(word + ' ');
        if (currentToks + wordToks > budget && currentUnits.length > 0) {
          flush();
        }
        currentUnits.push(word + ' ');
        currentToks += wordToks;
      }
    } else {
      if (currentToks + unitToks > budget && currentUnits.length > 0) {
        flush();
      }
      currentUnits.push(unit);
      currentToks += unitToks;
    }
  }

  flush();

  if (chunks.length > 0) {
    chunks[chunks.length - 1]!.is_last_in_section = true;
  }

  return chunks;
}

function mapChunkType(sectionType: string): DocumentChunk['chunk_type'] {
  switch (sectionType) {
    case 'header':
    case 'coram':
      return 'section_header';
    case 'preamble':
      return 'preamble';
    case 'order':
      return 'order';
    case 'section':
    case 'subsection':
    case 'proviso':
    case 'chapter':
      return 'provision';
    default:
      return 'paragraph';
  }
}

interface DocMeta {
  court: string;
  year: number;
  document_type: string;
  jurisdiction: string;
  concept_tags: string[];
  acts_referenced: string[];
  full_citation: string;
}

export function buildDocumentChunks(
  flatSections: SectionNode[],
  documentMeta: DocMeta,
): DocumentChunk[] {
  const result: DocumentChunk[] = [];
  let globalIndex = 0;

  for (const section of flatSections) {
    for (const chunk of splitSectionIntoChunks(section)) {
      if (chunk.token_count < 20) continue; // skip near-empty section headers

      result.push({
        document_id: '', // set by the runner before inserting
        chunk_index: globalIndex++,
        content: chunk.content,
        token_count: chunk.token_count,
        section_path: section.breadcrumb,
        section_title: section.title,
        chunk_type: mapChunkType(section.type),
        metadata: {
          court: documentMeta.court,
          year: documentMeta.year,
          document_type: documentMeta.document_type,
          jurisdiction: documentMeta.jurisdiction,
          concept_tags: documentMeta.concept_tags,
          acts_referenced: documentMeta.acts_referenced,
          full_citation: documentMeta.full_citation,
        },
      });
    }
  }

  return result;
}
