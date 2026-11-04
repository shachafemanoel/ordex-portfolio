import { EntityBadge } from '@/components/shared/display/EntityPrimitives';
import { getOrderStatusDisplay } from '@/components/shared/display/displayStatus';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import {
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OrderOpsData } from './types';
import { getStatusOperationalHint } from './utils';

interface OpsHeaderProps {
  orderData: OrderOpsData;
  isFetching: boolean;
  onClose: () => void;
  orderId: string;
}

export default function OpsHeader({ orderData, isFetching, onClose, orderId }: OpsHeaderProps) {
  const router = useRouter();
  const normalizedStatus = normalizeOrderStatus(String(orderData.status));
  const statusDisplay = getOrderStatusDisplay(normalizedStatus);
  const statusHint = getStatusOperationalHint(normalizedStatus);

  return (
    <div className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <EntityBadge label={orderData.number || orderId} tone="neutral" />
            <EntityBadge label={statusDisplay.label} tone={statusDisplay.tone} />
            {statusHint ? (
              <span className="line-clamp-1 text-[10px] font-bold text-slate-500">{statusHint}</span>
            ) : null}
          </div>
          <h2 className="text-base font-black tracking-[-0.03em] text-slate-900 sm:text-lg">ניהול הזמנה</h2>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-full border border-primary-100 bg-primary-50 px-3 text-xs font-bold text-[#34517a] transition-all active:scale-95 hover:bg-white"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
              router.push(`/orders/${orderId}`);
            }}
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">דף מלא</span>
          </button>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-all active:scale-95 hover:bg-slate-50 hover:text-slate-600"
            aria-label="סגור"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
