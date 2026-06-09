import { Tiktoken } from 'tiktoken/lite';
import cl100k from 'tiktoken/encoders/cl100k_base';
import { buildAugmentedText } from '../chunking/breadcrumb.js';
import type { DocumentChunk, EmbeddingInput } from '../shared/types.js';
import logger from '../shared/logger.js';

export { buildAugmentedText };

const encoder = new Tiktoken(cl100k.bpe_ranks, cl100k.special_tokens, cl100k.pat_str);

const TOKEN_LIMIT = 8000;

export function prepareEmbeddingInputs(
  chunks: Array<{
    id: string;
    content: string;
    metadata: DocumentChunk['metadata'];
    section_path: string[];
  }>
): EmbeddingInput[] {
  return chunks.map(chunk => {
    const m = chunk.metadata;
    const sectionPath = chunk.section_path.join(' > ');

    // Detect truncation before calling buildAugmentedText so we can warn.
    // buildAugmentedText handles the actual truncation internally.
    const prefixStr =
      [m.court, String(m.year), m.document_type, m.full_citation, sectionPath].join(' | ') + ' | ';
    const prefixToks = encoder.encode_ordinary(prefixStr).length;
    const contentToks = encoder.encode_ordinary(chunk.content).length;

    if (prefixToks + contentToks > TOKEN_LIMIT) {
      logger.warn('Chunk content will be truncated for embedding', {
        chunk_id: chunk.id,
        total_tokens: prefixToks + contentToks,
        limit: TOKEN_LIMIT,
      });
    }

    const docChunk: DocumentChunk = {
      document_id: '',
      chunk_index: 0,
      content: chunk.content,
      token_count: contentToks,
      section_path: chunk.section_path,
      section_title: chunk.section_path.at(-1) ?? '',
      chunk_type: 'paragraph',
      metadata: chunk.metadata,
    };

    const augmented_text = buildAugmentedText(docChunk);
    const token_count = encoder.encode_ordinary(augmented_text).length;

    return { chunk_id: chunk.id, augmented_text, token_count };
  });
}
