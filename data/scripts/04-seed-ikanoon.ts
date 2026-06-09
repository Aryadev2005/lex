/**
 * Seeds the Supabase DB with real Indian law documents fetched from the
 * Indian Kanoon API. Covers all 9 test-query categories. Documents are
 * inserted with status='enriched' so the chunk pipeline can process them.
 */
import ws from 'ws';
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as unknown as Record<string, unknown>)['WebSocket'] = ws;
}

import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false } }
);
const ORG_ID = process.env['PIPELINE_ORG_ID']!;
const IK_TOKEN = process.env['INDIAN_KANOON_API_KEY']!;
const IK_BASE = 'https://api.indiankanoon.org';

// ── Target searches — each fetches top 3 docs ────────────────────────────────
const SEED_SEARCHES = [
  // Constitutional
  { q: 'Article 14 reasonable classification intelligible differentia doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'writ mandamus private body Article 226 doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Kesavananda Bharati basic structure constitutional amendment doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'right to privacy fundamental right Article 21 Puttaswamy doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'freedom of speech Article 19 reasonable restrictions doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'S.R. Bommai Article 356 President Rule judicial review doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },

  // Criminal
  { q: 'NDPS bail Section 37 commercial quantity doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'beyond reasonable doubt standard of proof criminal trial doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 302 IPC murder culpable homicide Section 304 distinction doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 438 CrPC anticipatory bail conditions doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 498A IPC matrimonial cruelty harassment dowry doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 482 CrPC quash FIR inherent power High Court doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },

  // Contract
  { q: 'frustration of contract Section 56 Indian Contract Act doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'specific performance Specific Relief Act conditions discretion doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'anticipatory breach contract Section 39 Indian Contract Act doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },

  // Property
  { q: 'adverse possession animus possidendi Limitation Act doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 53A Transfer of Property Act part performance doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'limitation period recovery possession immovable property Article 65 doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },

  // IBC / Company
  { q: 'Section 14 IBC moratorium corporate insolvency resolution process doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 7 IBC financial creditor default insolvency application doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 53 IBC waterfall liquidation priority distribution doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },

  // Family
  { q: 'cruelty divorce Hindu Marriage Act Section 13 mental cruelty doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Shah Bano Section 125 CrPC maintenance Muslim wife iddat doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'irretrievable breakdown marriage Article 142 divorce doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },

  // Tax
  { q: 'GAAR General Anti-Avoidance Rule tax avoidance sham transaction doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'substance over form income tax colourable device doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Input Tax Credit CGST Section 16 ITC denied blocked credit', court: 'High Court', type: 'judgment' as const },

  // Procedural
  { q: 'Order 39 Rule 1 CPC temporary injunction prima facie case balance convenience doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
  { q: 'Section 5 Limitation Act condonation of delay sufficient cause doctypes:supremecourt', court: 'Supreme Court of India', type: 'judgment' as const },
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function ikGet(path: string): Promise<unknown> {
  const res = await fetch(`${IK_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Token ${IK_TOKEN}` },
  });
  if (!res.ok) throw new Error(`IK ${path} → HTTP ${res.status}`);
  return res.json();
}

interface IKSearchResult { docs?: Array<{ tid: number; title: string; docsource?: string; publishdate?: string; citation?: string }>; }
interface IKDoc { tid: number; title?: string; doc?: string; docsource?: string; publishdate?: string; citation?: string; }

// ── HTML → plain text ─────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mapCourtType(court: string): string {
  const lower = court.toLowerCase();
  if (lower.includes('supreme')) return 'supreme_court';
  if (lower.includes('nclt') || lower.includes('nclat')) return 'nclt';
  if (lower.includes('tribunal')) return 'tribunal';
  if (lower.includes('high')) return 'high_court';
  return 'other';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const inserted = new Set<number>();
  let total = 0;

  for (const seed of SEED_SEARCHES) {
    console.log(`\nSearching: ${seed.q.slice(0, 70)}…`);
    let searchResult: IKSearchResult;
    try {
      searchResult = (await ikGet(`/search/?formInput=${encodeURIComponent(seed.q)}&pagenum=0`)) as IKSearchResult;
    } catch (e) {
      console.warn('  search error:', (e as Error).message);
      continue;
    }

    const docs = searchResult.docs?.slice(0, 3) ?? [];
    if (docs.length === 0) { console.log('  no results'); continue; }

    for (const hit of docs) {
      if (inserted.has(hit.tid)) { console.log(`  skip dup tid ${hit.tid}`); continue; }
      inserted.add(hit.tid);

      await sleep(600); // be polite

      let doc: IKDoc;
      try {
        doc = (await ikGet(`/doc/${hit.tid}/`)) as IKDoc;
      } catch (e) {
        console.warn(`  fetch tid ${hit.tid} error:`, (e as Error).message);
        continue;
      }

      const htmlText = doc.doc ?? '';
      if (!htmlText) { console.warn(`  tid ${hit.tid} has no text`); continue; }

      const plainText = stripHtml(htmlText);
      if (plainText.length < 500) { console.warn(`  tid ${hit.tid} too short (${plainText.length} chars)`); continue; }

      const court = doc.docsource ?? seed.court ?? 'Unknown';
      const publishDate = doc.publishdate ?? '';
      const year = publishDate ? parseInt(publishDate.slice(0, 4), 10) : 0;
      const citation = doc.citation ?? '';
      const title = (doc.title ?? hit.title ?? '').replace(/<[^>]+>/g, '').slice(0, 500);

      const row = {
        org_id:            ORG_ID,
        file_name:         `ikanoon-${hit.tid}.txt`,
        file_path:         `ikanoon/${hit.tid}`,
        storage_bucket:    'documents',
        source:            'public_corpus',
        document_type:     seed.type,
        court_name:        court,
        court_type:        mapCourtType(court),
        jurisdiction:      'India',
        year:              year || null,
        citation:          citation || null,
        party_names:       {},
        acts_sections:     [],
        document_map:      {},
        content_text:      plainText,
        processing_metadata: {
          source_url: `https://indiankanoon.org/doc/${hit.tid}/`,
          tid: hit.tid,
          title,
        },
        status:            'enriched',
        is_public:         true,
      };

      const { data, error } = await sb.from('documents').insert(row).select('id').single();
      if (error) {
        console.error(`  insert tid ${hit.tid} error: ${error.message}`);
      } else {
        total++;
        console.log(`  ✓ [${total}] tid=${hit.tid}  year=${year}  ${court.slice(0,40)}`);
        console.log(`    ${title.slice(0, 80)}`);
      }
    }
  }

  console.log(`\n✅ Done — inserted ${total} documents`);
}

main().catch(err => { console.error(err); process.exit(1); });
