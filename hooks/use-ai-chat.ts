import { useState, useCallback, useRef } from 'react';
import apiClient from '@/lib/apiClient';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: unknown[];
  isLoading?: boolean;
  error?: boolean;
  reviewStatus?: 'pending' | 'accepted' | 'rejected';
}

interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  reviewMessage: (messageId: string, decision: 'accepted' | 'rejected') => void;
}

interface AiQueryResponse {
  result: string;
  toolCalls: unknown[];
  usage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
}

export function useAIChat(): UseAIChatReturn {
  const conversationIdRef = useRef<string>(`chat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'שלום! אני העוזר האישי שלך ברצף. איך אני יכול לעזור לך היום? אתה יכול לשאול אותי על הזמנות, ספקים, מלאי או ביצועים.',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Add user message
    const userMsgId = Date.now().toString();
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Use apiClient instead of fetch to handle auth and response wrapping
      const response = await apiClient.post<AiQueryResponse>('/api/ai/query', {
        query: text,
        conversationId: conversationIdRef.current
      });

      if (!response.success || !response.data) {
        // Extract error message properly - handle both string and object formats
        const errorMsg = typeof response.error?.message === 'string'
          ? response.error.message
          : (response.error?.details || (response.raw as any)?.details || 'Failed to fetch AI response');

        console.error('AI Query API Error:', {
          message: errorMsg,
          error: response.error,
          raw: response.raw
        });

        throw new Error(String(errorMsg));
      }

      const { result, toolCalls } = response.data;

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result,
        toolCalls,
        timestamp: new Date(),
        reviewStatus: toolCalls?.length ? 'pending' : 'accepted'
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error ? `שגיאה: ${error.message}` : 'מצטער, נתקלתי בשגיאה בעיבוד הבקשה שלך. אנא נסה שוב.',
        timestamp: new Date(),
        error: true,
        reviewStatus: 'accepted'
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reviewMessage = useCallback((messageId: string, decision: 'accepted' | 'rejected') => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              reviewStatus: decision,
            }
          : msg
      )
    );
  }, []);

  const clearMessages = useCallback(() => {
    // Reset conversation ID on clear
    conversationIdRef.current = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'שלום! אני העוזר האישי שלך ברצף. איך אני יכול לעזור לך היום?',
        timestamp: new Date(),
      },
    ]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    reviewMessage,
  };
}
