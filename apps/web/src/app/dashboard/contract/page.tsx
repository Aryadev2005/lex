'use client';

import { useState } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ExtractedClause {
  id: string;
  type: string;
  title: string;
  content: string;
  index: number;
}

interface ClauseResearch {
  clause_id: string;
  relevant_law: string;
  sources: string[];
  found_grounded: boolean;
}

interface RiskItem {
  clause_id: string;
  clause_type: string;
  clause_title: string;
  clause_content: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_explanation: string;
  legal_basis: string;
  legal_citations: string[];
  suggested_alternative: string;
}

interface ContractAnalysisResult {
  clauses: ExtractedClause[];
  research: ClauseResearch[];
  risks: RiskItem[];
  overall_risk_score: number;
  summary: string;
}

const MAX_CHARS = 50000;

const agentLabels: Record<string, string> = {
  extractor: 'Extractor',
  researcher: 'Researcher',
  analyzer: 'Analyzer',
};

const riskBadgeClass: Record<RiskItem['risk_level'], string> = {
  critical: 'bg-red-700',
  high: 'bg-orange-600',
  medium: 'bg-yellow-600',
  low: 'bg-green-700',
};

function RiskGauge({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = score > 70 ? '#b91c1c' : score > 40 ? '#ea580c' : '#15803d';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#334155" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="70" y="74" textAnchor="middle" fill="white" fontSize="26" fontWeight="bold">
          {score}
        </text>
        <text x="70" y="92" textAnchor="middle" fill="#94a3b8" fontSize="11">
          / 100
        </text>
      </svg>
    </div>
  );
}

function RiskCard({ risk }: { risk: RiskItem }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold text-white">{risk.clause_title}</p>
          <span className="inline-block rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
            {risk.clause_type}
          </span>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs uppercase text-white font-medium ${riskBadgeClass[risk.risk_level]}`}
        >
          {risk.risk_level}
        </span>
      </div>

      <p className="text-sm text-slate-200 leading-relaxed">{risk.risk_explanation}</p>
      <p className="text-sm italic text-slate-400">{risk.legal_basis}</p>

      {risk.legal_citations.length > 0 && (
        <p className="font-mono text-xs text-slate-500">{risk.legal_citations.join(' · ')}</p>
      )}

      <div className="rounded-md border border-indigo-800 bg-indigo-950/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-1">
          Suggested alternative
        </p>
        <p className="text-sm text-slate-200 leading-relaxed">{risk.suggested_alternative}</p>
      </div>
    </div>
  );
}

export default function ContractPage() {
  const [contractText, setContractText] = useState('');
  const { events, isStreaming, error, startStream } = useSSE();
  const token = useAuthStore((s) => s.token);

  function handleAnalyse() {
    if (!contractText.trim() || !token) return;
    startStream('/api/contract/analyze', { document_text: contractText }, token);
  }

  const progressEvents = events.filter((e) => e.type === 'progress');
  const latestProgress = progressEvents[progressEvents.length - 1] as
    | { type: 'progress'; agent: string; message: string; progress: number }
    | undefined;

  const resultEvent = events.find((e) => e.type === 'result') as
    | { type: 'result'; analysis: ContractAnalysisResult }
    | undefined;

  const hasActivity = isStreaming || events.length > 0;

  return (
    <div className="mx-auto max-w-7xl py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Contract Risk Analysis</h1>
        <p className="mt-1 text-sm text-slate-400">
          Analyse Indian commercial contracts for legal risks and get clause-level recommendations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <div className="space-y-3">
              <textarea
                value={contractText}
                onChange={(e) => setContractText(e.target.value)}
                placeholder="Paste your contract here…"
                style={{ minHeight: '16rem' }}
                className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 p-4 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none text-sm leading-relaxed"
                maxLength={MAX_CHARS}
              />

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Supports standard Indian commercial contracts. Max 50,000 characters.
                </p>
                <span
                  className={`text-xs tabular-nums ${
                    contractText.length > MAX_CHARS * 0.9 ? 'text-orange-400' : 'text-slate-500'
                  }`}
                >
                  {contractText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>

              <Button
                variant="primary"
                disabled={!contractText.trim() || isStreaming}
                isLoading={isStreaming}
                onClick={handleAnalyse}
              >
                Analyse Contract
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {error && (
            <Card className="border-red-700 bg-red-900/20">
              <p className="text-sm text-red-400">{error}</p>
            </Card>
          )}

          {!hasActivity && !error && (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 rounded-full bg-slate-700 p-4">
                  <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">Paste a contract to begin analysis</p>
              </div>
            </Card>
          )}

          {latestProgress && (
            <Card>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-block rounded bg-indigo-900/60 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                    {agentLabels[latestProgress.agent] ?? latestProgress.agent}
                  </span>
                  <span className="text-xs text-slate-400">{latestProgress.progress}%</span>
                </div>
                <p className="text-sm text-slate-300">{latestProgress.message}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
                    style={{ width: `${latestProgress.progress}%` }}
                  />
                </div>
              </div>
            </Card>
          )}

          {resultEvent && (
            <div className="space-y-4">
              <Card>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <RiskGauge score={resultEvent.analysis.overall_risk_score} />
                  <div className="space-y-2 text-center sm:text-left">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                      Overall Risk Score
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {resultEvent.analysis.summary}
                    </p>
                    <p className="text-xs text-slate-500">
                      {resultEvent.analysis.risks.length} clause
                      {resultEvent.analysis.risks.length !== 1 ? 's' : ''} analysed
                    </p>
                  </div>
                </div>
              </Card>

              {resultEvent.analysis.risks.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Clause Risk Breakdown
                  </p>
                  {resultEvent.analysis.risks.map((risk) => (
                    <RiskCard key={risk.clause_id} risk={risk} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
