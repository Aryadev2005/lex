import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';
import pLimit from 'p-limit';
import { TEST_QUERIES } from '../seeds/test-queries.js';
import { runQuery, type QueryResult } from './verification/runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

// ── ANSI colour helpers ──────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const GRAY   = '\x1b[90m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function green(s: string)  { return `${GREEN}${s}${RESET}`; }
function yellow(s: string) { return `${YELLOW}${s}${RESET}`; }
function red(s: string)    { return `${RED}${s}${RESET}`; }
function cyan(s: string)   { return `${CYAN}${s}${RESET}`; }
function bold(s: string)   { return `${BOLD}${s}${RESET}`; }
function gray(s: string)   { return `${GRAY}${s}${RESET}`; }

// ── Metrics types ────────────────────────────────────────────────────────────
interface VerificationMetrics {
  queries_with_results: number;
  queries_clearing_threshold: number;
  avg_top_similarity: number;
  avg_latency_ms: number;
}

type Verdict = 'VERIFIED' | 'MARGINAL' | 'FAILED';

interface VerificationReport {
  timestamp: string;
  verdict: Verdict;
  metrics: VerificationMetrics;
  worst_5_queries: QueryResult[];
  best_5_queries: QueryResult[];
  all_results: QueryResult[];
}

// ── Per-query formatted output ───────────────────────────────────────────────
function printQueryResult(qr: QueryResult): void {
  const { query, results, top_similarity, clears_threshold } = qr;

  const statusStr = clears_threshold
    ? green(`✅ CLEARS THRESHOLD (${top_similarity.toFixed(2)})`)
    : red(`❌ BELOW THRESHOLD (${top_similarity.toFixed(2)})`);

  console.log(`\n${bold(cyan(`QUERY [${query.id}]`))} ${query.query}`);
  console.log(`Status: ${statusStr}`);

  if (results.length === 0) {
    console.log(red('  No results returned'));
    return;
  }

  // Top result summary
  const top = results[0]!;
  const sectionDisplay = top.section_path.length > 0 ? top.section_path.join(' > ') : 'N/A';
  console.log(`Top result: ${top.court || 'Unknown'} | ${top.year || '?'} | ${sectionDisplay}`);
  const snippet = top.content.slice(0, 140).replace(/\s+/g, ' ').trim();
  console.log(gray(`  "${snippet}..."`));

  // Top 3 with scores
  const top3 = results.slice(0, 3);
  console.log('Top 3 results:');
  for (const r of top3) {
    const sim = r.similarity.toFixed(4);
    const cite = r.full_citation || `${r.court} ${r.year}`;
    console.log(`  ${r.rank}. [${sim}] ${cite}`);
  }

  // Expected keyword coverage
  const allText = results
    .slice(0, 5)
    .map(r => r.content + ' ' + r.full_citation + ' ' + r.section_path.join(' '))
    .join(' ')
    .toLowerCase();

  const found: string[] = [];
  const missing: string[] = [];
  for (const kw of query.expected_keywords) {
    if (allText.includes(kw.toLowerCase())) {
      found.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const foundStr  = found.length  > 0 ? green(`✅ [${found.join(', ')}]`)   : '';
  const missingStr = missing.length > 0 ? red(`❌ [${missing.join(', ')}]`) : '';
  console.log(`Expected keywords found: ${[foundStr, missingStr].filter(Boolean).join('  ')}`);
}

// ── Overall verdict block ────────────────────────────────────────────────────
function printVerdict(metrics: VerificationMetrics, verdict: Verdict): void {
  console.log('\n' + '═'.repeat(70));
  console.log(bold('VERIFICATION SUMMARY'));
  console.log('═'.repeat(70));
  console.log(`Queries with results:       ${metrics.queries_with_results} / ${TEST_QUERIES.length}`);
  console.log(`Clearing threshold (≥0.72): ${metrics.queries_clearing_threshold} / ${TEST_QUERIES.length}`);
  console.log(`Average top similarity:     ${metrics.avg_top_similarity.toFixed(4)}`);
  console.log(`Average latency:            ${metrics.avg_latency_ms.toFixed(0)} ms`);
  console.log('─'.repeat(70));

  if (verdict === 'VERIFIED') {
    console.log(bold(green('✅ DATA TANK VERIFIED — Phase 2 can begin')));
  } else if (verdict === 'MARGINAL') {
    console.log(bold(yellow('⚠️  MARGINAL — investigate failing queries before Phase 2')));
  } else {
    console.log(bold(red('❌ VERIFICATION FAILED — fix pipeline issues before Phase 2')));
  }
  console.log('═'.repeat(70));
}

// ── Worst/best summaries ─────────────────────────────────────────────────────
function printWorstBest(worst: QueryResult[], best: QueryResult[]): void {
  console.log('\n' + bold('BEST 5 QUERIES'));
  for (const qr of best) {
    console.log(`  [${qr.query.id}] ${qr.top_similarity.toFixed(4)}  ${qr.query.query.slice(0, 70)}`);
  }
  console.log('\n' + bold('WORST 5 QUERIES'));
  for (const qr of worst) {
    console.log(`  [${qr.query.id}] ${qr.top_similarity.toFixed(4)}  ${qr.query.query.slice(0, 70)}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(bold('\n' + '═'.repeat(70)));
  console.log(bold('  LEX DATA TANK VERIFICATION'));
  console.log(bold('═'.repeat(70)));
  console.log(`Running ${TEST_QUERIES.length} queries with concurrency 5…\n`);

  const limit = pLimit(5);
  let completed = 0;

  const resultPromises = TEST_QUERIES.map(query =>
    limit(async () => {
      const result = await runQuery(query);
      completed++;
      process.stdout.write(
        `\r${gray(`[${completed}/${TEST_QUERIES.length}]`)} ${result.clears_threshold ? green('✅') : red('❌')} ${query.id}`
      );
      return result;
    })
  );

  const allResults = await Promise.all(resultPromises);
  process.stdout.write('\n');

  // ── Compute metrics ──────────────────────────────────────────────────────
  const queriesWithResults = allResults.filter(r => r.top_similarity > 0.3).length;
  const clearingThreshold  = allResults.filter(r => r.clears_threshold).length;
  const avgSimilarity = allResults.reduce((s, r) => s + r.top_similarity, 0) / allResults.length;
  const avgLatency    = allResults.reduce((s, r) => s + r.latency_ms,   0) / allResults.length;

  const metrics: VerificationMetrics = {
    queries_with_results:       queriesWithResults,
    queries_clearing_threshold: clearingThreshold,
    avg_top_similarity:         avgSimilarity,
    avg_latency_ms:             avgLatency,
  };

  const sorted = [...allResults].sort((a, b) => a.top_similarity - b.top_similarity);
  const worst5 = sorted.slice(0, 5);
  const best5  = sorted.slice(-5).reverse();

  // ── Per-query output ─────────────────────────────────────────────────────
  for (const qr of allResults) {
    printQueryResult(qr);
  }

  // ── Verdict ──────────────────────────────────────────────────────────────
  let verdict: Verdict;
  if (clearingThreshold >= 40)      verdict = 'VERIFIED';
  else if (clearingThreshold >= 30) verdict = 'MARGINAL';
  else                              verdict = 'FAILED';

  printWorstBest(worst5, best5);
  printVerdict(metrics, verdict);

  // ── Write JSON report ────────────────────────────────────────────────────
  const reportsDir = resolve(__dirname, '../.reports');
  await mkdir(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = resolve(reportsDir, `verification-${timestamp}.json`);

  const report: VerificationReport = {
    timestamp: new Date().toISOString(),
    verdict,
    metrics,
    worst_5_queries: worst5,
    best_5_queries: best5,
    all_results: allResults,
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nReport written to: ${reportPath}`);

  // ── Exit code ────────────────────────────────────────────────────────────
  process.exitCode = verdict === 'VERIFIED' ? 0 : 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
