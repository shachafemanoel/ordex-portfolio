import { cn } from '@/lib/utils';

import type { DeliveryHubTabId } from './useDeliveryHubTabRouting';

interface DeliveryHubTabsProps {
  hubTab: DeliveryHubTabId;
  onChangeTab: (next: DeliveryHubTabId) => void;
}

const FUTURE_DELIVERIES_HINT = 'הזמנות עם תאריך משלוח ממחר עד סוף השבוע';

export function DeliveryHubTabs({ hubTab, onChangeTab }: Readonly<DeliveryHubTabsProps>) {
  const tabButtonClass = (id: DeliveryHubTabId) =>
    cn(
      'rounded-full px-4 py-2 text-xs font-black transition sm:text-sm',
      hubTab === id
        ? 'bg-accent-600 text-on-dark shadow-md shadow-[rgba(255,116,61,0.25)]'
        : 'bg-white/90 text-[#75665d] hover:bg-white'
    );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-[#f2ece8] bg-[#fff9f5] p-2 shadow-sm">
      <button type="button" className={tabButtonClass('trip')} onClick={() => onChangeTab('trip')}>
        נסיעה פעילה
      </button>
      <button type="button" className={tabButtonClass('active')} onClick={() => onChangeTab('active')}>
        משלוחים פעילים
      </button>
      <button type="button" className={tabButtonClass('future')} onClick={() => onChangeTab('future')}>
        משלוחים עתידיים
      </button>
      <p className="me-auto hidden text-[11px] font-medium text-[#9d8b80] lg:block">
        {hubTab === 'trip'
          ? 'מסך שטח, מפה ומעקב עצירות לפי מסלול פתוח'
          : hubTab === 'future'
            ? FUTURE_DELIVERIES_HINT
            : 'היום: כולל מוכנים ללא חלון זמן; בחר אזור או הזמנות ואז מסלול'}
      </p>
    </div>
  );
}
