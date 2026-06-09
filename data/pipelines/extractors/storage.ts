import { readFile } from 'fs/promises';
import { basename } from 'path';
import { supabase } from '../shared/db.js';
import type { ExtractionResult } from '../shared/types.js';

interface DocumentMeta {
  document_type: 'judgment' | 'legislation' | 'tribunal_order';
  court: string;
  year: number;
  jurisdiction: string;
  language: string;
  source_url: string;
  title: string;
  metadata: Record<string, unknown>;
}

export async function saveExtractedDocument(params: {
  localFilePath: string;
  extractionResult: ExtractionResult;
  documentMeta: DocumentMeta;
}): Promise<string> {
  const { localFilePath, extractionResult, documentMeta } = params;
  const filename = basename(localFilePath);
  const storagePath = `${documentMeta.document_type}/${documentMeta.court}/${documentMeta.year}/${filename}`;
  const textStoragePath = `${storagePath}.txt`;

  let pdfUploadFailed = false;
  try {
    const pdfBuffer = await readFile(localFilePath);
    const { error } = await supabase.storage
      .from('raw-documents')
      .upload(storagePath, pdfBuffer, { upsert: true, contentType: 'application/pdf' });
    if (error) {
      pdfUploadFailed = true;
      console.warn(`[storage] PDF upload failed: ${error.message}`);
    }
  } catch (err) {
    pdfUploadFailed = true;
    console.warn(`[storage] PDF upload error: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const textBuffer = Buffer.from(extractionResult.raw_text, 'utf-8');
    const { error } = await supabase.storage
      .from('extracted-text')
      .upload(textStoragePath, textBuffer, { upsert: true, contentType: 'text/plain; charset=utf-8' });
    if (error) console.warn(`[storage] Text upload failed: ${error.message}`);
  } catch (err) {
    console.warn(`[storage] Text upload error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const metadata: Record<string, unknown> = {
    ...documentMeta.metadata,
    extraction_method: extractionResult.extraction_method,
    char_count: extractionResult.char_count,
    non_ascii_ratio: extractionResult.non_ascii_ratio,
    quality_score: extractionResult.quality_score,
    page_count: extractionResult.page_count,
    language_detected: extractionResult.language_detected,
    pdf_storage_path: storagePath,
    text_storage_path: textStoragePath,
    ...(pdfUploadFailed && { pdf_upload_failed: true }),
  };

  const { data, error } = await supabase
    .from('documents')
    .insert({
      title: documentMeta.title,
      document_type: documentMeta.document_type,
      court: documentMeta.court,
      year: documentMeta.year,
      jurisdiction: documentMeta.jurisdiction,
      language: documentMeta.language,
      source_url: documentMeta.source_url,
      file_path: storagePath,
      raw_text: extractionResult.raw_text,
      metadata,
      status: 'extracted',
    })
    .select('id')
    .single();

  if (error) throw new Error(`saveExtractedDocument failed: ${error.message}`);
  return (data as { id: string }).id;
}
