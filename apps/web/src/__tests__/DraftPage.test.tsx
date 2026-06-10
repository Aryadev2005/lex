import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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
      user: { full_name: 'Test User' },
      isAuthed: true,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    }),
  ),
}));

const MOCK_TEMPLATES = [
  {
    id: 'legal_notice_general',
    name: 'Legal Notice (General)',
    description: 'A formal legal notice sent through an advocate.',
    document_type: 'legal_notice',
    court_type: null,
  },
  {
    id: 'vakalatnama_hc',
    name: 'Vakalatnama (High Court)',
    description: 'A formal authority letter appointing an advocate.',
    document_type: 'vakalatnama',
    court_type: 'high_court',
  },
];

function mockFetchSuccess() {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ templates: MOCK_TEMPLATES }),
  } as Response);
}

import DraftPage from '../app/dashboard/draft/page';
import { useSSE } from '@/hooks/useSSE';

describe('DraftPage', () => {
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

  it('renders template cards after fetch', async () => {
    mockFetchSuccess();
    render(<DraftPage />);

    await waitFor(() => {
      expect(screen.getByText('Legal Notice (General)')).toBeInTheDocument();
    });

    expect(screen.getByText('Vakalatnama (High Court)')).toBeInTheDocument();
  });

  it('clicking a template card advances to step 2 (shows textarea)', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    mockFetchSuccess();
    render(<DraftPage />);

    await waitFor(() => {
      expect(screen.getByText('Legal Notice (General)')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Legal Notice (General)'));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate document/i })).toBeInTheDocument();
  });

  it('shows document output when token events are present', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    vi.mocked(useSSE).mockReturnValue({
      events: [
        { type: 'token', content: 'TO,\n' },
        { type: 'token', content: 'Suresh Sharma\n' },
      ],
      isStreaming: false,
      error: null,
      startStream: vi.fn(),
      reset: vi.fn(),
    });

    mockFetchSuccess();
    render(<DraftPage />);

    await waitFor(() => {
      expect(screen.getByText('Legal Notice (General)')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Legal Notice (General)'));
    await user.type(
      screen.getByRole('textbox'),
      'I need to send a legal notice to recover my money.',
    );
    await user.click(screen.getByRole('button', { name: /generate document/i }));

    expect(screen.getByText(/Suresh Sharma/)).toBeInTheDocument();
  });

  it('shows Copy to Clipboard button when done event is present', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    vi.mocked(useSSE).mockReturnValue({
      events: [
        { type: 'token', content: 'Draft document content.' },
        { type: 'done' },
      ],
      isStreaming: false,
      error: null,
      startStream: vi.fn(),
      reset: vi.fn(),
    });

    mockFetchSuccess();
    render(<DraftPage />);

    await waitFor(() => {
      expect(screen.getByText('Legal Notice (General)')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Legal Notice (General)'));
    await user.type(
      screen.getByRole('textbox'),
      'I need to send a legal notice to recover my money.',
    );
    await user.click(screen.getByRole('button', { name: /generate document/i }));

    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draft another/i })).toBeInTheDocument();
  });
});
