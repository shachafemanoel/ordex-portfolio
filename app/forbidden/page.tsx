import { AccessDenied } from '@/components/ui/AccessDenied';

export const metadata = {
  title: 'אין הרשאה',
};

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <AccessDenied />
    </div>
  );
}
