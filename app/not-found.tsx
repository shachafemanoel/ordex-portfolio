import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center space-y-6 px-4 text-center"
      suppressHydrationWarning
    >
      <h1 className="text-5xl font-bold">404</h1>
      <p className="text-xl text-gray-600">העמוד שחיפשת לא קיים</p>
      <Link
        href="/"
        className="rounded-xl bg-blue-600 px-6 py-3 text-on-dark shadow hover:bg-blue-700"
      >
        חזרה לדף הבית
      </Link>
    </div>
  );
}
