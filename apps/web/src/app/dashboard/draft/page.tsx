'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface TemplateCard {
  id: string;
  name: string;
  description: string;
  document_type: string;
  court_type: string | null;
}

export default function DraftPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCard | null>(null);
  const [situation, setSituation] = useState('');

  const { events, isStreaming, startStream, reset } = useSSE();
  const token = useAuthStore(s => s.token);

  useEffect(() => {
    const baseUrl = process.env['NEXT_PUBLIC_API_URL'] ?? '';
    fetch(`${baseUrl}/api/draft/templates`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then((data: { templates: TemplateCard[] }) => setTemplates(data.templates))
      .catch(() => setTemplatesError('Failed to load templates'));
  }, [token]);

  function handleSelectTemplate(t: TemplateCard) {
    setSelectedTemplate(t);
    setStep(2);
  }

  function handleGenerate() {
    if (!selectedTemplate || !token) return;
    startStream(
      '/api/draft/generate',
      { template_id: selectedTemplate.id, situation_description: situation },
      token,
    );
    setStep(3);
  }

  function handleDraftAnother() {
    reset();
    setSelectedTemplate(null);
    setSituation('');
    setStep(1);
  }

  const tokenEvents = events.filter(e => e.type === 'token');
  const doneEvent = events.find(e => e.type === 'done');
  const accumulatedDocument = tokenEvents.map(e => e.content as string).join('');

  const documentTypeLabel = (dt: string) =>
    dt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Document Drafting</h1>
        <p className="mt-1 text-sm text-slate-400">
          Select a template, describe your situation, and get a polished legal document.
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Select a Template
          </h2>
          {templatesError && (
            <Card className="border-red-700 bg-red-900/20">
              <p className="text-sm text-red-400">{templatesError}</p>
            </Card>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className="rounded-xl border border-slate-700 bg-slate-800/50 p-5 text-left transition-colors hover:border-indigo-500 hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="font-semibold text-white">{t.name}</span>
                  <span className="shrink-0 rounded-full bg-indigo-900/60 px-2 py-0.5 text-xs text-indigo-300">
                    {documentTypeLabel(t.document_type)}
                  </span>
                </div>
                <p className="text-sm text-slate-400">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && selectedTemplate && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-indigo-900/60 px-3 py-1 text-xs font-medium text-indigo-300">
              {selectedTemplate.name}
            </span>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Change template
            </button>
          </div>
          <Card>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Describe your situation
                </span>
                <textarea
                  value={situation}
                  onChange={e => setSituation(e.target.value)}
                  placeholder="e.g. I am Ravi Kumar residing at 12, Park Street, Mumbai. I lent Rs 2,00,000 to Suresh Sharma on 1st March 2024. He has not repaid the amount despite repeated requests…"
                  className="min-h-48 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 p-4 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <Button
                variant="primary"
                disabled={!situation.trim()}
                onClick={handleGenerate}
              >
                Generate Document
              </Button>
            </div>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {isStreaming && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
              <svg
                className="h-4 w-4 animate-spin text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-sm text-slate-400">Generating and polishing document…</span>
            </div>
          )}

          {accumulatedDocument && (
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900 p-6 font-mono text-sm text-slate-100">
              {accumulatedDocument}
            </pre>
          )}

          {doneEvent && (
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  void navigator.clipboard.writeText(accumulatedDocument);
                }}
              >
                Copy to Clipboard
              </Button>
              <Button variant="secondary" onClick={handleDraftAnother}>
                Draft Another
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
