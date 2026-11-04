/**
 * FloatingAIChat Client Hook
 * Hook לשימוש בצ'אטבוט עם הקשר אוטומטי של הדף
 */

import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatResponse {
  message: string;
  agentType: string;
  conversationId: string;
  toolCalls: Array<{
    tool: string;
    params: unknown;
    result: unknown;
  }>;
  suggestedActions: Array<{
    label: string;
    action: string;
    params?: Record<string, unknown>;
  }>;
}

export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const pathname = usePathname();

  /**
   * Send message with automatic page context
   */
  const sendMessage = useCallback(
    async (message: string, pageData?: Record<string, unknown>) => {
      setIsLoading(true);

      // Add user message immediately
      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Build request with page context
        const requestBody = {
          message,
          conversationId,
          pageContext: {
            url: window.location.href,
            title: document.title,
            data: pageData, // Page-specific structured data
          },
        };

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data: { success: boolean; data: ChatResponse } = await response.json();

        if (!data.success) {
          throw new Error('Chat request failed');
        }

        // Update conversation ID
        if (!conversationId) {
          setConversationId(data.data.conversationId);
        }

        // Add assistant response
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        return data.data;
      } catch (error) {
        console.error('Chat error:', error);

        // Add error message
        const errorMessage: Message = {
          role: 'assistant',
          content: 'מצטער, אירעה שגיאה. נסה שוב.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId]
  );

  /**
   * Clear conversation
   */
  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearConversation,
    conversationId,
  };
}
