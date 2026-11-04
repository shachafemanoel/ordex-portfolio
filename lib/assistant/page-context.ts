export interface AssistantPageContext {
  path: string;
  title?: string;
  summary?: string;
  entities?: Record<string, string | number | null | undefined>;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

declare global {
  interface Window {
    __ordexPageContext?: AssistantPageContext;
  }
}

export function setAssistantPageContext(context: AssistantPageContext): void {
  if (typeof window === 'undefined') return;
  window.__ordexPageContext = context;
}

export function getAssistantPageContext(): AssistantPageContext | null {
  if (typeof window === 'undefined') return null;
  return window.__ordexPageContext ?? null;
}

export function clearAssistantPageContext(): void {
  if (typeof window === 'undefined') return;
  window.__ordexPageContext = undefined;
}
