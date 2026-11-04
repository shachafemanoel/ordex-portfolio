'use client';

import { Button } from '@/components/ui/Button';
import { useWorkflowStats } from '@/hooks/useWorkflowStats';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowLeft, CheckCircle2, Package, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function PageTaskBar() {
  const pathname = usePathname();
  const { data: stats, isLoading } = useWorkflowStats();

  if (isLoading || !stats) return null;

  // Determine context based on path
  // We define an interface for the task object
  interface TaskAlert {
    title: string;
    count: number;
    action: string;
    href: string;
    icon: any;
    bg: string;
    btnVariant: 'default' | 'outline' | 'secondary';
  }

  let activeTask: TaskAlert | null = null;

  // Logic: Show the earliest stage in the pipeline that has items
  if (pathname.includes('/orders')) {
    // Priority: Payment -> Purchasing -> Scheduling
    if (stats.payment_needed > 0) {
      activeTask = {
        title: 'טיפול ותשלום',
        count: stats.payment_needed,
        action: 'טפל בהזמנות',
        href: '/orders?status=TO_DO', // Using TO_DO/CALL_BACK generic filter via query usually, but keeping simple
        icon: PhoneCall,
        bg: 'bg-blue-50 border-blue-200 text-blue-900',
        btnVariant: 'default'
      };
    } else if (stats.purchasing_needed > 0) {
      activeTask = {
        title: 'רכש ומלאי',
        count: stats.purchasing_needed,
        action: 'עבור לרכש',
        href: '/orders?status=AWAITING_STOCK',
        icon: Package,
        bg: 'bg-orange-50 border-orange-200 text-orange-900',
        btnVariant: 'outline'
      };
    } else if (stats.scheduling_needed > 0) {
      activeTask = {
        title: 'מוכן לתיאום',
        count: stats.scheduling_needed,
        action: 'תאם כעת',
        href: '/orders?status=READY_FOR_INSTALL',
        icon: CheckCircle2,
        bg: 'bg-purple-50 border-purple-200 text-purple-900',
        btnVariant: 'outline'
      };
    }
  } else if (pathname.includes('/installations')) {
    if (stats.execution_needed > 0) {
      activeTask = {
        title: 'התקנות וביצוע',
        count: stats.execution_needed,
        action: 'צפה ביומן',
        href: '/installations', // Or calendar
        icon: AlertCircle,
        bg: 'bg-green-50 border-green-200 text-green-900',
        btnVariant: 'default'
      };
    }
  }

  if (!activeTask) return null;

  return (
    <div className={cn("w-full p-4 mb-6 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in slide-in-from-top-2", activeTask.bg)}>
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white/80 rounded-full shadow-sm backdrop-blur-sm">
          <activeTask.icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight">{activeTask.title}</h3>
          <p className="text-sm opacity-90 mt-1">
            ישנן <strong>{activeTask.count}</strong> משימות הממתינות לטיפולך בשלב זה
          </p>
        </div>
      </div>
      <div className="w-full sm:w-auto">
        <Link href={activeTask.href} className="w-full sm:w-auto block">
          <Button variant={activeTask.btnVariant} className="w-full sm:w-auto gap-2 shadow-sm">
            {activeTask.action}
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
