'use client';

import { useState, useRef, useEffect } from 'react';

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export function useSSE() {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  function startStream(
    endpoint: string,
    body: Record<string, unknown>,
    token: string,
  ): void {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsStreaming(true);
    setEvents([]);
    setError(null);

    const baseUrl = process.env['NEXT_PUBLIC_API_URL'] ?? '';

    (async () => {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          setError(`Request failed: ${response.status} ${response.statusText}`);
          setIsStreaming(false);
          return;
        }

        const reader = response.body!.getReader();
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
                const parsed = JSON.parse(chunk.slice(6)) as SSEEvent;
                setEvents(prev => [...prev, parsed]);
                if (parsed.type === 'error') {
                  setError((parsed as { type: string; message?: string }).message ?? 'An error occurred');
                }
              } catch {
                // malformed JSON — skip
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Stream error');
      } finally {
        setIsStreaming(false);
      }
    })();
  }

  function reset(): void {
    controllerRef.current?.abort();
    setEvents([]);
    setIsStreaming(false);
    setError(null);
  }

  return { events, isStreaming, error, startStream, reset };
}
