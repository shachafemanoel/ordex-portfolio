import { UserRole } from '@/lib/types';

interface ReportLayoutProps {
  title: string;
  children: React.ReactNode;
  userRole?: UserRole;
  actions?: React.ReactNode;
}

export function ReportLayout({ title, children, userRole: _userRole = 'ADMIN', actions }: ReportLayoutProps) {
  // Note: layout is provided by route group layout.tsx (AuthenticatedShell)
  // This wrapper just renders a page header to keep consistent look & feel.
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
