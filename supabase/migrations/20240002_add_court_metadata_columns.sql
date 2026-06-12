-- Add district court metadata columns to document_chunks if not present
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS judge_name text,
  ADD COLUMN IF NOT EXISTS state      text,
  ADD COLUMN IF NOT EXISTS district   text,
  ADD COLUMN IF NOT EXISTS source     text,
  ADD COLUMN IF NOT EXISTS tribunal   text;

-- Index for filtering by source (e.g. ecourts_api)
CREATE INDEX IF NOT EXISTS idx_document_chunks_source
  ON document_chunks (source);

-- Index for filtering by court_type (already set via existing insertChunks)
CREATE INDEX IF NOT EXISTS idx_document_chunks_court_type
  ON document_chunks (court_type);

-- Index for filtering by state + district
CREATE INDEX IF NOT EXISTS idx_document_chunks_state_district
  ON document_chunks (state, district);

-- Add district court metadata columns to documents if not present
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS state_name    text,
  ADD COLUMN IF NOT EXISTS district_name text,
  ADD COLUMN IF NOT EXISTS judge_name    text;
