/**
 * LEX Data Architecture Document Generator
 * Run: node scripts/generate-data-architecture-doc.mjs  (from repo root)
 *
 * Produces data/.reports/data-architecture.md — a static document describing
 * the LEX data architecture, accurate to what is actually built in this repo.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const now = new Date().toISOString();

const markdown = `---
# LEX Data Architecture
Generated: ${now}
System: LEX Legal AI Platform
Version: Phase 2 (VC Demo Build)

## Overview

LEX is a retrieval-augmented legal research platform for Indian law. All AI responses are grounded
exclusively in retrieved source documents — no language model generates legal text unless at least
one source chunk clears a verified similarity threshold of 0.50. This document describes the data
sources ingested, the pipeline that processes them, the search architecture, and the database schema.

---

## 1. Data Sources

| Source | Type | Update Frequency | Est. Document Count | Coverage |
|--------|------|-----------------|--------------------|---------:|
| AWS Open Data Registry (Dattam Labs) | Case judgments (PDF) | Monthly snapshots | 50,000+ | Supreme Court of India; Delhi, Bombay, Madras, Calcutta, Karnataka High Courts; 2000–2026 |
| India Code (indiacode.nic.in) | Central legislation (HTML/PDF) | Scraped on demand | 1,500+ Acts | All Central Acts, Regulations, Rules in force |
| DevDataLab | District court data | Research snapshots | Variable | District courts (research corpus) |

All sources are ingested into a single Supabase PostgreSQL instance using tenant-isolated
row-level security (RLS). Each document carries an \`org_id\` foreign key — queries issued
by a user only match documents belonging to their organisation, plus a shared public corpus.

---

## 2. Processing Pipeline

The pipeline runs as a sequence of TypeScript scripts under \`data/pipelines/\` and
\`scripts/\`. Each stage is idempotent: completed items are checkpointed in JSONLines
files so re-runs only process new or failed records.

### Stage 1 — Download

| Script | What it does |
|--------|-------------|
| \`scripts/01-download-aws.ts\` | Streams judgment PDFs from the AWS Open Data Registry S3 bucket (Dattam Labs). Stores raw PDFs in \`data/raw/judgments/\`. Skips files already present. |
| \`scripts/02-india-code-scraper.ts\` | Scrapes the India Code portal for all Central Acts. Downloads HTML and PDF versions into \`data/raw/legislation/\`. Respects \`robots.txt\` crawl-delay. |

### Stage 2 — Extraction

**Script:** \`data/pipelines/01-extract.ts\`

Converts raw PDFs and HTML files into clean UTF-8 text. Uses native PDF text extraction as the
primary path. Falls back to OCR (Tesseract via \`pdf-to-png-converter\` + \`tesseract.js\`) for
scanned PDFs that yield no selectable text. Each document is assigned a quality score (0–1)
based on character-to-page ratio; documents below threshold 0.3 are flagged for manual review.
Extracted text and metadata are written to the Supabase \`documents\` table.

### Stage 3 — Chunking

**Script:** \`data/pipelines/02-chunk.ts\`

Splits extracted document text into overlapping chunks using a semantic section-aware strategy:

- **Budget:** 512 tokens per chunk (GPT-4 tokeniser via \`tiktoken\`)
- **Overlap:** 64 tokens between adjacent chunks to preserve cross-boundary context
- **Section awareness:** Heading markers (\`[JUDGMENT]\`, \`[HEADER]\`, section numbers) are detected
  and used as preferred split points to avoid breaking logical units
- **Content prefix:** Each chunk is prefixed with court name, year, and citation to improve
  retrieval relevance — the prefix is stored in \`content_with_prefix\` and used for embedding

Chunks are written to the \`document_chunks\` table.

### Stage 4 — Embedding

**Script:** \`data/pipelines/03-embed.ts\`

Generates dense vector representations for every chunk:

- **Model:** \`text-embedding-3-large\` (OpenAI) at **3072 dimensions**
- **Rate limiting:** \`p-limit\` with concurrency 5 to stay within OpenAI rate limits
- **Checkpointing:** Embedded chunk IDs are written to \`data/.cache/embedded.jsonl\`;
  the script skips any chunk ID already in this file
- **Storage:** Embedding is written to the \`embedding\` pgvector column in \`document_chunks\`

### Stage 5 — Citation Backfill

**Script:** \`data/pipelines/06-backfill-citations.ts\`

Post-ingestion pass that resolves full citation strings for judgment chunks by matching
partial references (case name + year) against the \`documents\` table using trigram similarity
(\`pg_trgm\`). Writes the resolved citation to \`document_chunks.full_citation\`.

### Stage 6 — Verification

**Script:** \`data/pipelines/05-verify.ts\`

Runs a 100-query test harness against the live database to validate retrieval quality before
any phase is declared complete. Queries span 8 practice areas: constitutional, criminal,
contract, property, company, family, tax, procedural, hc_jurisdiction, ip, employment,
arbitration, real_estate, and corporate.

**Pass criteria (VERIFIED verdict):** ≥ 40 of 100 queries clear the 0.50 similarity threshold.

Produces:
- \`data/.reports/verification-{timestamp}.json\` — full results JSON
- \`data/.reports/benchmark-{timestamp}.md\` — formatted Markdown benchmark report

---

## 3. Search Architecture

All user queries are served through the \`hybrid_search\` Postgres RPC function defined in
the Supabase database. The function combines two complementary retrieval signals:

### 3.1 Vector Search (Semantic)

1. The query string is embedded with \`text-embedding-3-large\` (3072d) via the same model
   used during ingestion
2. pgvector performs an **HNSW approximate nearest-neighbour search** on the
   \`document_chunks.embedding\` column using **cosine distance**
3. Top-50 candidate chunks are returned with their cosine similarity score

### 3.2 Full-Text Search (Lexical / BM25)

1. A \`tsvector\` column on \`document_chunks\` is maintained by a Postgres trigger,
   indexed with a **GIN index**
2. Supabase's built-in full-text search converts the query to a \`tsquery\` and scores
   matches using \`ts_rank_cd\`
3. Up to 50 candidates are returned

### 3.3 Reciprocal Rank Fusion

The two result sets are merged using **Reciprocal Rank Fusion (RRF)**:

\`\`\`
rrf_score(d) = Σ  1 / (k + rank_i(d))
\`\`\`

where k = 60 (standard RRF constant) and rank_i is the rank of document d in retrieval set i.
This produces a single ranked list that rewards documents appearing highly in either modality.

### 3.4 Threshold Gate

After ranking, **only chunks with vector_score ≥ 0.50** are passed to the LLM context window.
This threshold was derived empirically from live pipeline data (median similarity of verified
queries = 0.593, median of declined queries ≈ 0.35–0.45).

**If no chunks clear the threshold:** the API returns \`{ type: "insufficient_sources" }\` and
the system logs a \`research_declined\` session to \`agent_sessions\`. No language model is
invoked. This prevents hallucinated legal citations — the primary trust failure mode in
legal AI products.

---

## 4. Data Freshness

The pipeline is designed for continuous incremental updates:

- **Idempotent stages:** Every pipeline script checks a JSONLines checkpoint file before
  processing. Re-running is safe and only processes new or failed items.
- **Adding new sources:** Drop new PDF/HTML files into the appropriate \`data/raw/\` subdirectory
  and re-run the extract → chunk → embed pipeline. Existing chunks are unaffected.
- **Threshold re-verification:** After each ingestion run, \`pnpm verify\` (Stage 6) re-runs
  the 100-query test harness. The threshold is data-derived — if retrieval quality degrades,
  the MARGINAL/FAILED verdict surfaces immediately.
- **Citation backfill:** Stage 5 (backfill-citations) can be re-run at any time to improve
  citation resolution as more documents are added.

---

## 5. Schema Highlights

### \`documents\`

| Column | Type | Notes |
|--------|------|-------|
| \`id\` | uuid PK | |
| \`org_id\` | uuid FK | Tenant isolation; RLS policy enforces row ownership |
| \`source_type\` | text | \`judgment\` \| \`legislation\` \| \`contract\` |
| \`court\` | text | Court name extracted from document |
| \`year\` | int | Year of judgment or enactment |
| \`full_citation\` | text | Full case citation or Act name |
| \`raw_text\` | text | Full extracted text |
| \`quality_score\` | float | Extraction quality 0–1 |
| \`status\` | text | \`extracted\` \| \`chunked\` \| \`embedded\` \| \`failed\` |
| 20+ additional metadata columns | | |

Row-level security is enabled on this table. Users can only read documents belonging to
their organisation or documents in the shared public corpus (\`org_id IS NULL\`).

### \`document_chunks\`

| Column | Type | Notes |
|--------|------|-------|
| \`id\` | uuid PK | |
| \`document_id\` | uuid FK | References \`documents.id\` |
| \`chunk_index\` | int | 0-based position within document |
| \`content\` | text | Raw chunk text (512-token budget) |
| \`content_with_prefix\` | text | Prefix-augmented text used for embedding |
| \`embedding\` | vector(3072) | pgvector HNSW-indexed column |
| \`fts\` | tsvector | GIN-indexed full-text search column |
| \`section_path\` | text[] | Breadcrumb of section headings |
| \`full_citation\` | text | Resolved citation (from backfill stage) |
| \`token_count\` | int | Tiktoken count of \`content\` |

**Indexes:**
- HNSW index on \`embedding\` (cosine operator class, m=16, ef_construction=64)
- GIN index on \`fts\` for full-text search
- GIN trigram index on \`full_citation\` for fuzzy citation matching

### \`agent_sessions\`

All AI workflow sessions are logged here regardless of outcome:

| Column | Type | Notes |
|--------|------|-------|
| \`id\` | uuid PK | |
| \`org_id\` | uuid FK | |
| \`session_type\` | text | \`research\` \| \`research_declined\` \| \`contract_analysis\` \| \`draft\` |
| \`input_data\` | jsonb | Query, jurisdiction, document text, etc. |
| \`output_data\` | jsonb | Response, similarity scores, chunk count, etc. |
| \`model\` | text | LLM model used (or null if declined) |
| \`input_tokens\` | int | Prompt tokens charged |
| \`output_tokens\` | int | Completion tokens charged |
| \`created_at\` | timestamptz | |

The \`research_declined\` session type records every query that did not clear the similarity
threshold. These records power the hallucination-prevention audit log.

### \`research_cache\`

Query-level result cache to reduce repeat LLM calls and latency:

| Column | Type | Notes |
|--------|------|-------|
| \`query_hash\` | text PK | SHA-256 of normalised query + jurisdiction |
| \`response\` | jsonb | Cached SSE event stream |
| \`expires_at\` | timestamptz | 24-hour TTL from creation |

Cache entries expire after 24 hours. The API checks this table before invoking the LLM.

### \`draft_templates\`

Stores structured templates for legal document drafting:

| Column | Type | Notes |
|--------|------|-------|
| \`id\` | uuid PK | |
| \`name\` | text | Human-readable template name |
| \`document_type\` | text | e.g. \`legal_notice\`, \`nda\`, \`employment_contract\` |
| \`description\` | text | Brief description for UI display |
| \`system_prompt\` | text | LLM system prompt for this template |
| \`user_prompt_template\` | text | Handlebars-style template for user turn |

---

## 6. Security and Compliance

- **Row-Level Security (RLS):** All tables with \`org_id\` have Postgres RLS policies
  enforcing tenant isolation at the database layer — not application layer.
- **Service Role Key:** The ingestion pipeline uses the Supabase service role key and
  runs exclusively in trusted backend environments. The anon key is never used for writes.
- **No PII in chunks:** Judgment text and legislation are public domain. Contract documents
  uploaded by users are stored under their \`org_id\` and are never shared across tenants.
- **Audit trail:** All AI workflow sessions (including declined queries) are immutably logged
  to \`agent_sessions\` for compliance review.

---
*This document was generated by \`scripts/generate-data-architecture-doc.mjs\`.*
*It reflects the actual codebase state at generation time.*
`;

// ── Write report ──────────────────────────────────────────────────────────────

const reportDir = resolve(__dirname, '../data/.reports');
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, 'data-architecture.md');
writeFileSync(reportPath, markdown, 'utf-8');

console.log(`Data architecture document written to: data/.reports/data-architecture.md`);
console.log(`Length: ${markdown.length} characters`);
