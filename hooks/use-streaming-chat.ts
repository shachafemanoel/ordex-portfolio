'use client';

import { getAssistantPageContext } from '@/lib/assistant/page-context';
import { DEFAULT_ACTION_SUGGESTIONS } from '@/lib/assistant/suggestions';
import type { NextSuggestion, UIPayload } from '@/lib/assistant/uiPayloadSchema';
import { aiPost } from '@/lib/client/aiClient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Chat turn types
 */
export interface StreamingAssistantTurn {
  type: 'assistant';
  id: string;
  content: string;
  isStreaming: boolean;
  payload?: UIPayload;
  receivedAt: string;
}

export interface StreamingUserTurn {
  type: 'user';
  id: string;
  content: string;
  receivedAt: string;
}

export type StreamingChatTurn = StreamingAssistantTurn | StreamingUserTurn;

type StreamPhase = 'idle' | 'thinking' | 'streaming' | 'done';

interface UseStreamingChatReturn {
  history: StreamingChatTurn[];
  phase: StreamPhase;
  isLoading: boolean;
  error: string | null;
  suggestions: NextSuggestion[];
  sendMessage: (message: string, context?: Record<string, any>) => void;
  triggerAction: (actionId: string, params?: Record<string, any>) => Promise<void>;
  resetHistory: () => void;
}

export function useStreamingChat(contextKey: string): UseStreamingChatReturn {
  const [history, setHistory] = useState<StreamingChatTurn[]>([]);
  const [phase, setPhase] = useState<StreamPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<NextSuggestion[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch context-aware suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      if (typeof window === 'undefined') return;
      try {
        const path = window.location.pathname;
        const pageContext =
          getAssistantPageContext() ?? { path, title: document.title };
        const response = await aiPost<any>('/api/assistant/suggestions', {
          path,
          context: pageContext,
        });
        if (response.data) {
          const data = response.data;
          if (Array.isArray(data)) {
            setDynamicSuggestions(data);
          } else if (data.data && Array.isArray(data.data)) {
            setDynamicSuggestions(data.data);
          }
        }
      } catch {
        // silently fail
      }
    }
    fetchSuggestions();
  }, [history.length]);

  const suggestions = useMemo<NextSuggestion[]>(() => {
    return dynamicSuggestions.length > 0 ? dynamicSuggestions : DEFAULT_ACTION_SUGGESTIONS;
  }, [dynamicSuggestions]);

  /**
   * Send a chat message with SSE streaming response
   */
  const sendMessage = useCallback(
    (message: string, context?: Record<string, any>) => {
      if (!message.trim() || phase === 'streaming' || phase === 'thinking') return;

      // Abort any previous stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Add user turn
      const userTurn: StreamingUserTurn = {
        type: 'user',
        id: `user-${Date.now()}`,
        content: message.trim(),
        receivedAt: new Date().toISOString(),
      };

      const assistantTurnId = `resp-${Date.now()}`;

      setHistory((prev) => [
        ...prev,
        userTurn,
        {
          type: 'assistant',
          id: assistantTurnId,
          content: '',
          isStreaming: true,
          receivedAt: new Date().toISOString(),
        },
      ]);

      setPhase('thinking');
      setError(null);

      // Start SSE stream
      (async () => {
        try {
          const orderContext =
            context?.order
              ? { id: String(context.order.id), status: context.order.status }
              : undefined;

          const response = await fetch('/api/assistant/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: message.trim(),
              contextKey,
              context: {
                path: typeof window !== 'undefined' ? window.location.pathname : '/',
                page: context?.page,
                order: orderContext,
              },
            }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status}`);
          }

          if (!response.body) {
            throw new Error('No response body');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullText = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let currentEvent = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                const dataStr = line.slice(6);
                try {
                  const data = JSON.parse(dataStr);

                  if (currentEvent === 'thinking') {
                    setPhase('thinking');
                  } else if (currentEvent === 'token') {
                    setPhase('streaming');
                    fullText += data;

                    // Update the assistant turn content incrementally
                    setHistory((prev) => {
                      const updated = [...prev];
                      const lastIdx = updated.length - 1;
                      if (lastIdx >= 0 && updated[lastIdx].type === 'assistant') {
                        updated[lastIdx] = {
                          ...updated[lastIdx],
                          content: fullText,
                          isStreaming: true,
                        } as StreamingAssistantTurn;
                      }
                      return updated;
                    });
                  } else if (currentEvent === 'done') {
                    // Mark streaming as complete
                    setHistory((prev) => {
                      const updated = [...prev];
                      const lastIdx = updated.length - 1;
                      if (lastIdx >= 0 && updated[lastIdx].type === 'assistant') {
                        updated[lastIdx] = {
                          ...updated[lastIdx],
                          content: data,
                          isStreaming: false,
                        } as StreamingAssistantTurn;
                      }
                      return updated;
                    });
                    setPhase('done');
                    setTimeout(() => setPhase('idle'), 100);
                  } else if (currentEvent === 'error') {
                    setError(data);
                    setPhase('idle');
                    // Remove the empty assistant turn
                    setHistory((prev) => {
                      const updated = [...prev];
                      const lastIdx = updated.length - 1;
                      if (
                        lastIdx >= 0 &&
                        updated[lastIdx].type === 'assistant' &&
                        !(updated[lastIdx] as StreamingAssistantTurn).content
                      ) {
                        updated.pop();
                      }
                      return updated;
                    });
                  }
                } catch {
                  // ignore parse errors
                }
                currentEvent = '';
              }
            }
          }

          // If stream ended without a done event, finalize
          if (phase !== 'idle') {
            setPhase('idle');
            setHistory((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (
                lastIdx >= 0 &&
                updated[lastIdx].type === 'assistant' &&
                (updated[lastIdx] as StreamingAssistantTurn).isStreaming
              ) {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  isStreaming: false,
                } as StreamingAssistantTurn;
              }
              return updated;
            });
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          setError(err.message || 'Stream failed');
          setPhase('idle');
        }
      })();
    },
    [contextKey, phase]
  );

  /**
   * Fallback: trigger a non-streaming action (for suggestions, etc.)
   */
  const triggerAction = useCallback(
    async (actionId: string, params: Record<string, any> = {}) => {
      if (!contextKey) return;
      setPhase('thinking');
      setError(null);

      // If it's a chat action, use streaming
      if (actionId === 'chat' && params.message) {
        sendMessage(params.message, params.context);
        return;
      }

      try {
        const response = await aiPost<UIPayload>('/api/assistant/action', {
          actionId,
          contextKey,
          params,
        });

        if (!response.ok || !response.data) {
          throw new Error(response.error?.message || 'Action failed');
        }

        setHistory((prev) => [
          ...prev,
          {
            type: 'assistant',
            id: actionId,
            content: '',
            isStreaming: false,
            payload: response.data as UIPayload,
            receivedAt: new Date().toISOString(),
          },
        ]);
      } catch (err: any) {
        setError(err.message || 'Action error');
      } finally {
        setPhase('idle');
      }
    },
    [contextKey, sendMessage]
  );

  const resetHistory = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setHistory([]);
    setError(null);
    setPhase('idle');
  }, []);

  return {
    history,
    phase,
    isLoading: phase === 'thinking' || phase === 'streaming',
    error,
    suggestions,
    sendMessage,
    triggerAction,
    resetHistory,
  };
}
