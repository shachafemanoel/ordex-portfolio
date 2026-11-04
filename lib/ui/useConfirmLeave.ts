import { useEffect } from 'react';

export function useConfirmLeave(enabled: boolean, message = 'יש שינויים שלא נשמרו. לעזוב את העמוד?') {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!enabled) {
      return undefined;
    }

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);

    return () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [enabled, message]);
}
