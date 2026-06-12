'use client';

import { useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

function MinimalMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="mb-2 mt-6 text-lg font-semibold text-white">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="mb-3 mt-6 text-xl font-bold text-white">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p key={i} className="leading-relaxed text-slate-200">
          {line}
        </p>,
      );
    }
    i++;
  }

  return <div>{elements}</div>;
}

export default function ResearchPage() {
  const [query, setQuery] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');

  const { events, isStreaming, error, startStream, reset } = useSSE();
  const token = useAuthStore(s => s.token);

  function handleSubmit() {
    if (!query.trim() || !token) return;
    startStream(
      '/api/research/query',
      { query, jurisdiction: jurisdiction || undefined, match_count: 12 },
      token,
    );
  }

  const sourcesEvent = events.find(e => e.type === 'sources');
  const tokenEvents = events.filter(e => e.type === 'token');
  const insufficientEvent = events.find(e => e.type === 'insufficient_sources');
  const doneEvent = events.find(e => e.type === 'done');

  const accumulatedContent = tokenEvents
    .map(e => e.content as string)
    .join('');

  const streamingEnded = !isStreaming && events.length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Legal Research</h1>
        <p className="mt-1 text-sm text-slate-400">
          Ask any Indian law question and get cited, verified answers.
        </p>
      </div>

      <Card>
        <div className="space-y-4">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. What is the test for reasonable classification under Article 14 of the Constitution?"
            style={{ minHeight: '120px' }}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 p-4 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />

          <input
            type="text"
            value={jurisdiction}
            onChange={e => setJurisdiction(e.target.value)}
            placeholder="e.g. Delhi High Court"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />

          <div className="flex gap-3">
            <Button
              variant="primary"
              disabled={isStreaming || !query.trim()}
              isLoading={isStreaming}
              onClick={handleSubmit}
            >
              Research
            </Button>

            {streamingEnded && (
              <Button variant="secondary" onClick={reset}>
                New Query
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && !isStreaming && (
        <div className="rounded-md border border-red-700 bg-red-900/30 px-4 py-3">
          <p className="text-sm font-semibold text-red-300">Request failed</p>
          <p className="text-sm text-red-400 mt-1">{error}</p>
        </div>
      )}

      {sourcesEvent && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
          <p className="text-sm text-slate-400">
            Searching{' '}
            {Array.isArray(sourcesEvent.sources)
              ? (sourcesEvent.sources as unknown[]).length
              : 0}{' '}
            verified sources…
          </p>
        </div>
      )}

      {insufficientEvent && (
        <Card className="border-yellow-600 bg-yellow-900/20">
          <p className="text-sm text-yellow-300">
            No sufficiently verified sources found for this query. Please refine
            your question or try a different jurisdiction.
          </p>
        </Card>
      )}

      {accumulatedContent && (
        <Card>
          <MinimalMarkdown text={accumulatedContent} />
        </Card>
      )}

      {doneEvent && (
        <div className="inline-flex items-center gap-2 rounded-full bg-green-900/40 px-3 py-1 text-xs font-medium text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          Research complete
        </div>
      )}
    </div>
  );
}
