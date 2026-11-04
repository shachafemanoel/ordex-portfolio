import Link from 'next/link';
import { ArrowLeft, CalendarDays, ClipboardList, MapPin, Truck } from 'lucide-react';

export interface DashboardOverviewQuickAction {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly iconKey: 'orders' | 'deliveries' | 'calendar' | 'operations';
}

const ICONS = {
  orders: ClipboardList,
  deliveries: Truck,
  calendar: CalendarDays,
  operations: MapPin,
} as const;

export interface DashboardOverviewQuickActionsProps {
  readonly actions: ReadonlyArray<DashboardOverviewQuickAction>;
}

export function DashboardOverviewQuickActions({
  actions,
}: Readonly<DashboardOverviewQuickActionsProps>) {
  const safeActions: ReadonlyArray<DashboardOverviewQuickAction> = Array.isArray(actions) ? actions : [];

  if (!safeActions.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-right font-display text-[11px] font-bold uppercase tracking-[0.18em] text-fg-muted">
        פעולות מהירות
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        {safeActions.map((action) => {
          const Icon = ICONS[action.iconKey];
          return (
            <Link
              key={action.href}
              href={action.href}
              title={action.description}
              className="group flex min-w-[9.5rem] shrink-0 items-center gap-2.5 rounded-full border border-surface-strong bg-surface-translucent-strong px-4 py-2.5 text-right shadow-[0_8px_28px_rgba(0,77,151,0.06)] backdrop-blur-sm transition hover:border-brand-soft hover:bg-surface sm:min-w-0"
            >
              <span className="bg-brand-gradient-br flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-inverse shadow-inner">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-extrabold text-fg">{action.label}</span>
                  <ArrowLeft
                    className="h-3.5 w-3.5 shrink-0 text-fg-subtle opacity-40 transition group-hover:opacity-80"
                    aria-hidden
                  />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
