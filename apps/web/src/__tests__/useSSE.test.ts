import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '../hooks/useSSE';

describe('useSSE', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets error state when SSE stream emits { type: "error" }', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"error","message":"upstream failure"}\n\n'),
        );
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const { result } = renderHook(() => useSSE());

    await act(async () => {
      result.current.startStream('/api/research/query', { query: 'test' }, 'token');
      // Wait for the async streaming to complete
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current.error).toBe('upstream failure');
    expect(result.current.isStreaming).toBe(false);
  });
});
