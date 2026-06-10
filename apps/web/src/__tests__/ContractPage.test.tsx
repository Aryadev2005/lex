import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(() => ({
    events: [],
    isStreaming: false,
    error: null,
    startStream: vi.fn(),
    reset: vi.fn(),
  })),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: {
    token: string;
    user: { full_name: string };
    isAuthed: boolean;
    setAuth: ReturnType<typeof vi.fn>;
    clearAuth: ReturnType<typeof vi.fn>;
  }) => unknown) =>
    selector({
      token: 'test-token',
      user: { full_name: 'Test' },
      isAuthed: true,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    }),
  ),
}));

import ContractPage from '../app/dashboard/contract/page';
import { useSSE } from '@/hooks/useSSE';

const MOCK_RISK = {
  clause_id: 'clause_1',
  clause_type: 'indemnity',
  clause_title: 'Indemnity',
  clause_content: 'test',
  risk_level: 'high' as const,
  risk_explanation: 'risky',
  legal_basis: 'Indian Contract Act',
  legal_citations: [] as string[],
  suggested_alternative: 'better language',
};

const RESULT_EVENT = {
  type: 'result' as const,
  analysis: {
    risks: [MOCK_RISK],
    overall_risk_score: 65,
    summary: 'Medium risk',
    clauses: [],
    research: [],
  },
};

describe('ContractPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSSE).mockReturnValue({
      events: [],
      isStreaming: false,
      error: null,
      startStream: vi.fn(),
      reset: vi.fn(),
    });
  });

  it('renders textarea and Analyse Contract button', () => {
    render(<ContractPage />);
    expect(screen.getByPlaceholderText(/paste your contract here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyse contract/i })).toBeInTheDocument();
  });

  it('button is disabled when textarea is empty', () => {
    render(<ContractPage />);
    expect(screen.getByRole('button', { name: /analyse contract/i })).toBeDisabled();
  });

  it('shows risk result card when events include result type', () => {
    vi.mocked(useSSE).mockReturnValue({
      events: [RESULT_EVENT],
      isStreaming: false,
      error: null,
      startStream: vi.fn(),
      reset: vi.fn(),
    });

    render(<ContractPage />);

    // Risk level badge should show 'high'
    const badge = screen.getByText(/^high$/i);
    expect(badge).toBeInTheDocument();
  });

  it('shows progress bar when progress event is present', () => {
    vi.mocked(useSSE).mockReturnValue({
      events: [
        {
          type: 'progress',
          agent: 'extractor',
          message: 'Identifying and categorising contract clauses…',
          progress: 10,
        },
      ],
      isStreaming: true,
      error: null,
      startStream: vi.fn(),
      reset: vi.fn(),
    });

    render(<ContractPage />);

    expect(
      screen.getByText(/identifying and categorising contract clauses/i),
    ).toBeInTheDocument();
    // Progress bar div should be in the DOM
    const bar = document.querySelector('[style*="width: 10%"]');
    expect(bar).not.toBeNull();
  });
});
