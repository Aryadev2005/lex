// scripts/integration-test.mjs
// Full-stack integration test for LEX
// Run with: node scripts/integration-test.mjs

const API = 'http://localhost:3001';
const TEST_EMAIL = `lex-test-${Date.now()}@lexai.dev`;
const TEST_PASSWORD = 'TestPass123!';

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function json(url, opts = {}) {
  const res = await fetch(url, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function collectSSE(url, opts = {}, timeoutMs = 30000) {
  const events = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) return { status: res.status, events };

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        if (chunk.startsWith('data: ')) {
          try {
            events.push(JSON.parse(chunk.slice(6)));
          } catch {}
        }
      }
    }

    clearTimeout(timer);
    return { status: res.status, events };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') return { status: 0, events, timedOut: true };
    throw e;
  }
}

// ─── AUTH TESTS ───────────────────────────────────────────────────────────────

console.log('\n📋 Auth Tests');

const reg = await json(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, full_name: 'LEX Test User' }),
});

assert('Register returns 200 or 201', reg.status === 200 || reg.status === 201, `got ${reg.status}`);
assert('Register returns token', typeof reg.body.token === 'string');
assert('Register returns user.email', reg.body.user?.email === TEST_EMAIL);
assert('Register returns user.full_name', reg.body.user?.full_name === 'LEX Test User');

const TOKEN = reg.body.token;

const login = await json(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
});

assert('Login returns 200', login.status === 200, `got ${login.status}`);
assert('Login returns token', typeof login.body.token === 'string');

const badLogin = await json(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: 'WrongPassword!' }),
});

assert('Bad credentials returns 401', badLogin.status === 401, `got ${badLogin.status}`);

const unauth = await json(`${API}/test/db`);
assert('Unauthenticated /test/db returns 401', unauth.status === 401, `got ${unauth.status}`);

// ─── DB STATUS TEST ───────────────────────────────────────────────────────────

console.log('\n📋 DB Status Test');

const db = await json(`${API}/test/db`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});

assert('DB status returns 200', db.status === 200, `got ${db.status}`);
assert('DB status has connected field', typeof db.body.connected === 'boolean');
assert('DB is connected', db.body.connected === true, 'Supabase connection failed');

// ─── DRAFT TEMPLATES TEST ────────────────────────────────────────────────────

console.log('\n📋 Draft Templates Test');

const templates = await json(`${API}/api/draft/templates`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});

assert('Templates returns 200', templates.status === 200, `got ${templates.status}`);
assert('Templates array exists', Array.isArray(templates.body.templates));
assert('At least 1 template', templates.body.templates?.length >= 1);

const firstTemplate = templates.body.templates?.[0];
assert('Template has id', typeof firstTemplate?.id === 'string');
assert('Template has name', typeof firstTemplate?.name === 'string');
assert('Template has description', typeof firstTemplate?.description === 'string');
assert('Template has document_type', typeof firstTemplate?.document_type === 'string');

// ─── RESEARCH SSE TEST ───────────────────────────────────────────────────────

console.log('\n📋 Research SSE Test');

const research = await collectSSE(`${API}/api/research/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({
    query: 'What is the test for reasonable classification under Article 14?',
    jurisdiction: 'Supreme Court of India',
    match_count: 5,
  }),
}, 45000);

assert('Research SSE returns 200', research.status === 200, `got ${research.status}`);
assert('Research SSE emits events', research.events.length > 0, `got ${research.events.length} events`);
assert('Research SSE not timed out', !research.timedOut);

const hasSourcesOrInsufficient =
  research.events.some(e => e.type === 'sources') ||
  research.events.some(e => e.type === 'insufficient_sources');
assert('Research SSE emits sources or insufficient_sources', hasSourcesOrInsufficient);
assert('Research SSE emits done', research.events.some(e => e.type === 'done'));

const tokenEvents = research.events.filter(e => e.type === 'token');
if (tokenEvents.length > 0) {
  assert('Research token events have content field', typeof tokenEvents[0].content === 'string');
}

// ─── CONTRACT SSE TEST ───────────────────────────────────────────────────────

console.log('\n📋 Contract SSE Test');

const SAMPLE_CONTRACT = `AGREEMENT dated 1 January 2025 between Party A (Service Provider) and Party B (Client).
LIMITATION OF LIABILITY: Party A liability shall not exceed Rs. 1,000 under any circumstances.
INDEMNIFICATION: Party B shall indemnify Party A against all claims, losses and damages.
JURISDICTION: Courts of New Delhi shall have exclusive jurisdiction.`;

const contract = await collectSSE(`${API}/api/contract/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ document_text: SAMPLE_CONTRACT }),
}, 90000);

assert('Contract SSE returns 200', contract.status === 200, `got ${contract.status}`);
assert('Contract SSE emits events', contract.events.length > 0);
assert('Contract SSE not timed out', !contract.timedOut);
assert('Contract SSE emits progress events', contract.events.some(e => e.type === 'progress'));

const resultEvent = contract.events.find(e => e.type === 'result');
assert('Contract SSE emits result', !!resultEvent);

if (resultEvent) {
  const a = resultEvent.analysis;
  assert('Result has clauses array', Array.isArray(a?.clauses));
  assert('Result has risks array', Array.isArray(a?.risks));
  assert('Result has overall_risk_score', typeof a?.overall_risk_score === 'number');
  assert('Risk score 0–100', a?.overall_risk_score >= 0 && a?.overall_risk_score <= 100);
  assert('Result has summary', typeof a?.summary === 'string');

  if (a?.risks?.length > 0) {
    const r = a.risks[0];
    assert('Risk has clause_id', typeof r.clause_id === 'string');
    assert('Risk has risk_level', ['low','medium','high','critical'].includes(r.risk_level));
    assert('Risk has risk_explanation', typeof r.risk_explanation === 'string');
    assert('Risk has legal_citations array', Array.isArray(r.legal_citations));
    assert('Risk has suggested_alternative', typeof r.suggested_alternative === 'string');
  }
}

// ─── DRAFT GENERATE SSE TEST ─────────────────────────────────────────────────

console.log('\n📋 Draft Generate SSE Test');

const TEMPLATE_ID = firstTemplate?.id;

const draft = await collectSSE(`${API}/api/draft/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({
    template_id: TEMPLATE_ID,
    situation_description: 'I am Ravi Kumar of 12 Park Street Mumbai. I lent Rs 2,00,000 to Suresh Sharma on 1 March 2024. He has not repaid despite repeated reminders.',
  }),
}, 90000);

assert('Draft SSE returns 200', draft.status === 200, `got ${draft.status}`);
assert('Draft SSE emits events', draft.events.length > 0);
assert('Draft SSE not timed out', !draft.timedOut);

const draftTokens = draft.events.filter(e => e.type === 'token');
assert('Draft SSE emits token events', draftTokens.length > 0);

if (draftTokens.length > 0) {
  assert('Draft token has content field', typeof draftTokens[0].content === 'string');
}

assert('Draft SSE emits done', draft.events.some(e => e.type === 'done'));

const fullDocument = draftTokens.map(e => e.content).join('');
assert('Draft produces non-empty document', fullDocument.length > 100, `got ${fullDocument.length} chars`);

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('─'.repeat(50));

if (failed > 0) {
  console.error('\n❌ Integration test FAILED — fix the issues above before proceeding');
  process.exit(1);
} else {
  console.log('\n✅ All integration tests PASSED — LEX Phase 0 + Phase 2 is solid');
  process.exit(0);
}
