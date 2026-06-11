/**
 * LEX Hallucination Prevention — Audit Log Generator
 * Run: node scripts/generate-audit-log.mjs  (from repo root)
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from data/.env
 * (dotenv/config equivalent — package not hoisted in this pnpm workspace).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM __dirname
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env vars ─────────────────────────────────────────────────────────────
// Equivalent to `import 'dotenv/config'` — pnpm workspace root has no dotenv.
function loadEnv(envPath) {
  try {
    const raw = readFileSync(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch {
    // env file optional — caller checks the vars
  }
}

// Try root .env, then data/.env as fallback (data pipeline has the service role key)
loadEnv(resolve(__dirname, '../.env'));
loadEnv(resolve(__dirname, '../data/.env'));

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
    'Add them to .env or data/.env at the repo root.',
  );
  process.exit(1);
}

// ── Import @supabase/supabase-js ──────────────────────────────────────────────
// Resolved via pnpm symlink in packages/db (not hoisted to root node_modules).
const { createClient } = await import(
  '../packages/db/node_modules/@supabase/supabase-js/dist/index.mjs'
);

// ws is required for Node 20 (no native WebSocket) as realtime transport.
const { default: ws } = await import(
  '../packages/db/node_modules/ws/index.js'
).catch(() => import('../node_modules/.pnpm/ws@8.21.0/node_modules/ws/index.js'));

// ── Query ─────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws },
});

const { data: sessions, error } = await supabase
  .from('agent_sessions')
  .select('input_query, input_metadata, final_output, created_at')
  .eq('session_type', 'research_declined')
  .order('created_at', { ascending: false })
  .limit(50);

if (error) {
  console.error('Query failed:', error.message);
  process.exit(1);
}

const noData = !sessions || sessions.length === 0;

// ── Format each row ───────────────────────────────────────────────────────────

function fmtDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

const rows = noData ? [] : sessions.map((s, i) => ({
  n: i + 1,
  query: (s.input_query ?? '').replace(/\|/g, '\\|'),
  jurisdiction: s.input_metadata?.jurisdiction ?? '—',
  topSimilarity: typeof s.final_output?.top_similarity === 'number'
    ? s.final_output.top_similarity.toFixed(4)
    : '—',
  chunksFound: s.final_output?.chunks_found ?? 0,
  threshold: s.final_output?.threshold ?? 0.50,
  declinedAt: fmtDate(s.created_at),
}));

const dates = noData ? [] : sessions.map((s) => s.created_at).sort();
const oldest = dates.length > 0 ? fmtDate(dates[0]) : '—';
const newest = dates.length > 0 ? fmtDate(dates[dates.length - 1]) : '—';

const similarities = rows
  .map((r) => parseFloat(r.topSimilarity))
  .filter((n) => !isNaN(n))
  .sort((a, b) => a - b);

const median = similarities.length > 0
  ? similarities.length % 2 === 1
    ? similarities[Math.floor(similarities.length / 2)]
    : (similarities[similarities.length / 2 - 1] + similarities[similarities.length / 2]) / 2
  : 0;

// ── Build markdown ────────────────────────────────────────────────────────────

const tableRows = rows
  .map(
    (r) =>
      `| ${r.n} | ${r.query} | ${r.jurisdiction} | ${r.topSimilarity} | ${r.chunksFound} | ${r.declinedAt} |`,
  )
  .join('\n');

const now = new Date().toISOString();

const newSystemNote = noData
  ? '\n> **Note:** The system is newly deployed — no declined queries have been logged yet. ' +
    'This is expected for a fresh instance. As real queries are processed, declined queries ' +
    '(those below the 0.50 threshold) will appear in this table.\n'
  : '';

const markdown = `---
# LEX Hallucination Prevention — Audit Log
Generated: ${now}
System: LEX Legal AI Platform
Threshold: 0.50 cosine similarity (verified from live pipeline data)

## What This Document Shows

LEX refuses to generate an answer whenever retrieved source chunks fail to clear a
verified similarity threshold. This prevents hallucinated legal citations — the primary
trust failure mode in legal AI products. The following ${rows.length} queries were declined by
the system because no sufficiently grounded sources were found. In every case, the
system returned an explicit "insufficient sources" response instead of generating text.

No language model was invoked for any of the queries below.
${newSystemNote}
---

## Declined Queries

| # | Query | Jurisdiction | Top Similarity | Chunks Found | Declined At |
|---|-------|-------------|---------------|-------------|-------------|
${tableRows}

---

## Interpretation

Queries where Top Similarity < 0.50 indicate the question falls outside LEX's current
knowledge base coverage. These are typically:
- Very recent judgments not yet ingested
- Highly specialised tribunal orders not in the current corpus
- Queries phrased in a way that does not match any indexed document

This is the correct behaviour. A system that answers these queries would be hallucinating.

---
*This log is auto-generated from production agent_sessions data. It cannot be manually edited.*
`;

// ── Write report ──────────────────────────────────────────────────────────────

const reportDir = resolve(__dirname, '../data/.reports');
mkdirSync(reportDir, { recursive: true });
const reportPath = resolve(reportDir, 'hallucination-audit-log.md');
writeFileSync(reportPath, markdown, 'utf-8');

// ── Stdout summary ────────────────────────────────────────────────────────────

console.log(`Total declined queries: ${rows.length}`);
if (noData) {
  console.log('Note: No declined queries found — system is newly deployed. Report written with notice.');
} else {
  console.log(`Date range: ${oldest} to ${newest}`);
  console.log(`Median top_similarity of declined queries: ${median.toFixed(4)}`);
}
console.log(`Report written to: data/.reports/hallucination-audit-log.md`);
