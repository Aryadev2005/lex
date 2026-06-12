-- Adds a new 4-parameter overload of hybrid_search that accepts an optional
-- p_document_types filter. The existing 6-parameter version remains untouched
-- so that runner.ts / test-similarity.ts keep working unchanged.
--
-- Parameter naming uses the p_ prefix so PostgREST can disambiguate the
-- overload when called from rag.ts with named arguments.

CREATE OR REPLACE FUNCTION hybrid_search(
  p_query_text      text,
  p_query_embedding vector(3072),
  p_match_count     int,
  p_document_types  text[] DEFAULT NULL   -- NULL = no filter (all court types)
)
RETURNS TABLE (
  chunk_id           uuid,
  document_id        uuid,
  content            text,
  citation           text,
  court_name         text,
  jurisdiction       text,
  year               integer,
  chunk_type         text,
  section_hierarchy  jsonb,
  legal_tags         text[],
  rrf_score          double precision,
  vector_score       double precision,
  fts_score          double precision
)
LANGUAGE sql
STABLE
AS $func$
  WITH
  -- Vector search: top candidates ranked by cosine similarity
  vec AS (
    SELECT
      dc.id                                        AS chunk_id,
      dc.document_id,
      1.0 - (dc.embedding <=> p_query_embedding)   AS similarity,
      ROW_NUMBER() OVER (
        ORDER BY dc.embedding <=> p_query_embedding
      )                                            AS rnk
    FROM document_chunks dc
    WHERE dc.embedding IS NOT NULL
      AND dc.is_public = true
      AND (
        p_document_types IS NULL
        OR dc.court_type::text = ANY(p_document_types)
        OR EXISTS (
          SELECT 1 FROM documents d
          WHERE d.id = dc.document_id
            AND d.court_type::text = ANY(p_document_types)
        )
      )
    ORDER BY dc.embedding <=> p_query_embedding
    LIMIT GREATEST(p_match_count * 10, 50)
  ),

  -- Full-text search: top candidates ranked by ts_rank_cd
  fts AS (
    SELECT
      dc.id          AS chunk_id,
      dc.document_id,
      ts_rank_cd(
        to_tsvector('english', dc.content),
        plainto_tsquery('english', p_query_text)
      )              AS fts_rank,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(
          to_tsvector('english', dc.content),
          plainto_tsquery('english', p_query_text)
        ) DESC
      )              AS rnk
    FROM document_chunks dc
    WHERE dc.is_public = true
      AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', p_query_text)
      AND (
        p_document_types IS NULL
        OR dc.court_type::text = ANY(p_document_types)
        OR EXISTS (
          SELECT 1 FROM documents d
          WHERE d.id = dc.document_id
            AND d.court_type::text = ANY(p_document_types)
        )
      )
    LIMIT GREATEST(p_match_count * 10, 50)
  ),

  -- Reciprocal Rank Fusion (k = 60, matching the existing 6-param function)
  merged AS (
    SELECT
      COALESCE(v.chunk_id,    f.chunk_id)    AS chunk_id,
      COALESCE(v.document_id, f.document_id) AS document_id,
      COALESCE(v.similarity,  0.0)           AS vector_score,
      COALESCE(f.fts_rank,    0.0)           AS fts_score,
      COALESCE(1.0 / (60.0 + v.rnk::double precision), 0.0)
        + COALESCE(1.0 / (60.0 + f.rnk::double precision), 0.0) AS rrf_score
    FROM vec v
    FULL OUTER JOIN fts f ON v.chunk_id = f.chunk_id
  )

  SELECT
    m.chunk_id,
    m.document_id,
    dc.content,
    COALESCE(dc.citation,     '')             AS citation,
    COALESCE(dc.court_name,   '')             AS court_name,
    COALESCE(dc.jurisdiction, '')             AS jurisdiction,
    dc.year,
    dc.chunk_type::text,
    dc.section_hierarchy,
    dc.legal_tags,
    m.rrf_score,
    m.vector_score,
    m.fts_score
  FROM merged m
  JOIN document_chunks dc ON dc.id = m.chunk_id
  ORDER BY m.rrf_score DESC
  LIMIT p_match_count
$func$;
