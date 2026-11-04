import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, LucideIcon } from 'lucide-react';
import Link from 'next/link';

export interface ActionTask {
  id: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  href: string;
  severity?: 'high' | 'medium' | 'low';
}

interface ActionRequiredWidgetProps {
  title: string;
  tasks: ActionTask[];
  className?: string;
  emptyState?: string;
  viewAllHref?: string;
}

export function ActionRequiredWidget({
  title,
  tasks,
  className,
  emptyState = 'אין משימות פתוחות',
  viewAllHref = '/orders?status=TO_DO,CALL_BACK,PENDING_APPROVAL',
}: ActionRequiredWidgetProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col',
        className
      )}
    >
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          {title}
        </h3>
        <Link
          href={viewAllHref}
          className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
        >
          {tasks.length} ממתינים
        </Link>
      </div>

      <div className="divide-y divide-slate-50">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{emptyState}</div>
        ) : (
          tasks.map((task) => (
            <Link
              key={task.id}
              href={task.href}
              className="group flex items-center justify-between p-4 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-4">
                {task.icon && (
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      task.severity === 'high'
                        ? 'bg-rose-100 text-rose-600'
                        : task.severity === 'medium'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-blue-100 text-blue-600'
                    )}
                  >
                    <task.icon className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm group-hover:text-primary transition-colors">
                    {task.title}
                  </h4>
                  {task.subtitle && (
                    <p className="text-xs text-slate-500 mt-0.5">{task.subtitle}</p>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'text-xs gap-1 hover:bg-white hover:shadow-sm pointer-events-none'
                )}
              >
                בצע
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))
        )}
      </div>

      {tasks.length > 0 && (
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
          <Link
            href={viewAllHref}
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-full py-1"
          >
            צפה בכל המשימות
            <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
