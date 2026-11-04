'use client';

import { getAssistantPageContext } from '@/lib/assistant/page-context';
import { DEFAULT_ACTION_SUGGESTIONS } from '@/lib/assistant/suggestions';
import type { NextSuggestion, UIPayload } from '@/lib/assistant/uiPayloadSchema';
import { aiPost } from '@/lib/client/aiClient';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Assistant Turn Definition
 */
export interface AssistantTurn {
  type: 'assistant';
  id: string;
  payload: UIPayload;
  receivedAt: string;
}

/**
 * User Turn Definition
 */
export interface UserTurn {
  type: 'user';
  id: string;
  content: string;
  receivedAt: string;
}

export type ChatTurn = AssistantTurn | UserTurn;

interface UseAssistantEngineReturn {
  contextKey: string;
  history: ChatTurn[];
  lastPayload: UIPayload | null;
  suggestions: NextSuggestion[];
  isLoading: boolean;
  error: string | null;
  triggerAction: (actionId: string, params?: Record<string, any>) => Promise<void>;
  resetHistory: () => void;
}

export function useAssistantEngine(initialContextKey?: string): UseAssistantEngineReturn {
  const [contextKey, setContextKey] = useState<string>(() => {
    if (initialContextKey) return initialContextKey;
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('ordex-assistant-context');
      if (stored) return stored;
    }
    return '';
  });
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contextKey) {
      const stored =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('ordex-assistant-context')
          : null;
      const generated = stored || `assistant_${Date.now().toString(36)}`;
      setContextKey(generated);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ordex-assistant-context', generated);
      }
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ordex-assistant-context', contextKey);
    }
  }, [contextKey]);

  const [dynamicSuggestions, setDynamicSuggestions] = useState<NextSuggestion[]>([]);

  // Fetch context-aware suggestions
  useEffect(() => {
    async function fetchSuggestions() {
      if (typeof window === 'undefined') return;
      try {
        const path = window.location.pathname;
        const pageContext =
          getAssistantPageContext() ?? {
            path,
            title: document.title,
          };
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
      } catch (err) {
        console.warn('Failed to fetch suggestions', err);
      }
    }
    fetchSuggestions();
  }, [history.length]); // Refresh when history changes

  const lastAssistantTurn = [...history].reverse().find(t => t.type === 'assistant') as AssistantTurn | undefined;
  const lastPayload = lastAssistantTurn ? lastAssistantTurn.payload : null;

  const suggestions = useMemo<NextSuggestion[]>(() => {
    if (lastPayload?.nextSuggestions?.length) {
      return lastPayload.nextSuggestions;
    }
    return dynamicSuggestions.length > 0 ? dynamicSuggestions : DEFAULT_ACTION_SUGGESTIONS;
  }, [lastPayload, dynamicSuggestions]);

  const triggerAction = useCallback(
    async (actionId: string, params: Record<string, any> = {}) => {
      if (!contextKey) return;
      setIsLoading(true);
      setError(null);

      // If this is a chat action, optimistically add user message
      if (actionId === 'chat' && params.message) {
        setHistory((prev) => [
          ...prev,
          {
            type: 'user',
            id: `user-${Date.now()}`,
            content: params.message,
            receivedAt: new Date().toISOString(),
          },
        ]);
      } else if (actionId !== 'chat') {
        // For other actions, maybe show a system message or just the result?
        // We can add a "System/User action" marker if we want, but for now let's leave it.
      }

      try {
        // Use aiPost for actions - deduplicates request if same action is triggered rapidly
        const response = await aiPost<UIPayload>('/api/assistant/action', {
          actionId,
          contextKey,
          params,
        });

        if (!response.ok || !response.data) {
          throw new Error(response.error?.message || 'הפעולה נכשלה');
        }

        setHistory((prev) => [
          ...prev,
          {
            type: 'assistant',
            id: actionId === 'chat' ? `resp-${Date.now()}` : actionId,
            payload: response.data as UIPayload,
            receivedAt: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'שגיאה כללית';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [contextKey]
  );

  const resetHistory = useCallback(() => {
    setHistory([]);
    setError(null);
  }, []);

  return {
    contextKey,
    history,
    lastPayload,
    suggestions,
    isLoading,
    error,
    triggerAction,
    resetHistory,
  };
}
