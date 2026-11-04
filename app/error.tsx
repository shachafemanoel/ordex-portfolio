'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-xl font-bold text-red-600 mb-4">שגיאה באפליקציה</h1>
        <p className="text-gray-600 mb-4">אירעה שגיאה לא צפויה. אנא נסה לרענן את הדף.</p>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-on-dark rounded hover:bg-blue-700"
          >
            נסה שוב
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            חזור לעמוד הבית
          </button>
        </div>
        {error.digest && <p className="text-xs text-gray-400 mt-4">מזהה שגיאה: {error.digest}</p>}
      </div>
    </div>
  );
}
