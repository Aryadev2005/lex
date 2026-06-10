import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock useSSE
vi.mock('@/hooks/useSSE', () => ({
  useSSE: vi.fn(() => ({
    events: [],
    isStreaming: false,
    error: null,
    startStream: vi.fn(),
    reset: vi.fn(),
  })),
}));

// Mock useAuthStore
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

import ResearchPage from '../app/dashboard/research/page';
import { useSSE } from '@/hooks/useSSE';

describe('ResearchPage', () => {
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

  it('renders query textarea and Research button', () => {
    render(<ResearchPage />);
    expect(
      screen.getByPlaceholderText(/reasonable classification under Article 14/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /research/i })).toBeInTheDocument();
  });

  it('Research button is disabled when textarea is empty', () => {
    render(<ResearchPage />);
    expect(screen.getByRole('button', { name: /research/i })).toBeDisabled();
  });

  it('Research button is not disabled when textarea has content', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ResearchPage />);

    await user.type(
      screen.getByPlaceholderText(/reasonable classification under Article 14/i),
      'What is Article 14?',
    );

    expect(screen.getByRole('button', { name: /research/i })).not.toBeDisabled();
  });

  it('renders insufficient_sources warning when that event type is present', () => {
    vi.mocked(useSSE).mockReturnValue({
      events: [{ type: 'insufficient_sources', message: 'test' }],
      isStreaming: false,
      error: null,
      startStream: vi.fn(),
      reset: vi.fn(),
    });

    render(<ResearchPage />);

    expect(
      screen.getByText(/no sufficiently verified sources found/i),
    ).toBeInTheDocument();
  });

  it('renders token content when token events are present', () => {
    vi.mocked(useSSE).mockReturnValue({
      events: [
        { type: 'token', content: 'Hello' },
        { type: 'token', content: ' world' },
      ],
      isStreaming: false,
      error: null,
      startStream: vi.fn(),
      reset: vi.fn(),
    });

    render(<ResearchPage />);

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });
});
