'use client';

import { Button } from '@/components/ui/Button';
import { getFriendlyErrorMessage } from '@/lib/error-messages';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Server Component Render Error:', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in">
      <div className="rounded-full bg-red-100 p-4 text-red-600 text-4xl mb-2">⚠️</div>
      <h2 className="text-2xl font-bold text-gray-900">שגיאה בטעינת העמוד</h2>

      <div className="max-w-lg w-full bg-red-50 border border-red-200 rounded-lg p-6 text-left overflow-auto shadow-sm">
        <p className="font-mono text-sm text-red-700 break-words font-semibold">
          {getFriendlyErrorMessage(error)}
        </p>

        {error.digest && (
          <div className="mt-4 pt-4 border-t border-red-200">
            <p className="text-xs text-red-500 font-mono">
              <span className="font-bold">Error Digest:</span> {error.digest}
            </p>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && error.stack && (
          <div className="mt-4 pt-4 border-t border-red-200">
            <details>
              <summary className="text-xs text-red-500 cursor-pointer hover:underline mb-2">
                Stack Trace
              </summary>
              <pre className="text-[10px] bg-white p-2 rounded border border-red-100 overflow-x-auto">
                {error.stack}
              </pre>
            </details>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
          חזרה לדשבורד
        </Button>
        <Button onClick={() => reset()} className="px-6">
          נסה שוב
        </Button>
      </div>
    </div>
  );
}
