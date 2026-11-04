'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-gray-50">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h1 className="mb-4 text-xl font-bold text-red-600">שגיאה קריטית</h1>
            <p className="mb-4 text-gray-600">
              אירעה שגיאה קריטית במערכת. אנא רענן את הדף או צור קשר עם התמיכה הטכנית.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded bg-blue-600 px-4 py-2 text-on-dark hover:bg-blue-700"
              >
                נסה שוב
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                חזור לעמוד הבית
              </button>
            </div>
            {error.digest ? <p className="mt-4 text-xs text-gray-400">מזהה שגיאה: {error.digest}</p> : null}
          </div>
        </div>
      </body>
    </html>
  );
}
