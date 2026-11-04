'use client';

import { AlertTriangle, MapPin, ShieldCheck, TrendingUp } from 'lucide-react';

import {
  EntityBadge,
  EntitySurface,
  type EntityTone,
} from '@/components/shared/display/EntityPrimitives';
import { cn } from '@/lib/utils';

const INSIGHTS: Array<{
  title: string;
  eyebrow: string;
  summary: string;
  detail: string;
  icon: typeof TrendingUp;
  tone: EntityTone;
  delayClassName: string;
  interactive?: boolean;
}> = [
  {
    title: '25%',
    eyebrow: 'רווחיות',
    summary: 'צפי רווח מצוין להזמנה זו',
    detail: 'מרווח בריא ביחס להזמנות דומות',
    icon: TrendingUp,
    tone: 'success',
    delayClassName: '[animation-delay:0ms]',
  },
  {
    title: 'לקוח בטוח',
    eyebrow: 'סיכון לקוח',
    summary: 'היסטוריית תשלומים תקינה',
    detail: 'לא נדרשת בדיקת גבייה נוספת',
    icon: ShieldCheck,
    tone: 'info',
    delayClassName: '[animation-delay:100ms]',
  },
  {
    title: 'פריט X במחסור',
    eyebrow: 'מלאי',
    summary: 'נותרו 5 יחידות במחסן',
    detail: 'כדאי לפתוח רכש לפני התיאום',
    icon: AlertTriangle,
    tone: 'warning',
    delayClassName: '[animation-delay:200ms]',
  },
  {
    title: 'איחוד אפשרי',
    eyebrow: 'לוגיסטיקה',
    summary: 'לשלב עם הזמנה #1234',
    detail: 'מסלול קרוב חוסך זמן הגעה',
    icon: MapPin,
    tone: 'accent',
    delayClassName: '[animation-delay:300ms]',
    interactive: true,
  },
];

function getInsightToneClasses(tone: EntityTone) {
  switch (tone) {
    case 'success':
      return {
        iconWrap: 'bg-emerald-50 text-[#008c39]',
        value: 'text-emerald-950',
        detail: 'text-emerald-800/80',
      };
    case 'warning':
      return {
        iconWrap: 'bg-[#fff1e6] text-[#d45f00]',
        value: 'text-[#9a5319]',
        detail: 'text-[#9a5319]/80',
      };
    case 'accent':
      return {
        iconWrap: 'bg-violet-50 text-violet-700',
        value: 'text-violet-950',
        detail: 'text-violet-800/80',
      };
    case 'info':
      return {
        iconWrap: 'bg-blue-50 text-primary-600',
        value: 'text-blue-950',
        detail: 'text-[#34517a]',
      };
    case 'neutral':
    default:
      return {
        iconWrap: 'bg-slate-100 text-slate-600',
        value: 'text-slate-950',
        detail: 'text-slate-600',
      };
  }
}

export function SmartOrderInsights() {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
      {INSIGHTS.map((insight) => {
        const tone = getInsightToneClasses(insight.tone);

        return (
          <EntitySurface
            key={insight.eyebrow}
            className={cn(
              'flex flex-col gap-2.5 p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500 [animation-fill-mode:backwards]',
              insight.interactive && 'cursor-pointer',
              insight.delayClassName
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', tone.iconWrap)}>
                <insight.icon className="h-4 w-4" />
              </div>
              <EntityBadge label={insight.eyebrow} tone={insight.tone} size="sm" />
            </div>

            <div className={cn('text-base font-black tracking-tight sm:text-xl', tone.value)}>
              {insight.title}
            </div>

            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-900">{insight.summary}</p>
              <p className={cn('text-[11px] font-medium', tone.detail)}>{insight.detail}</p>
            </div>
          </EntitySurface>
        );
      })}
    </div>
  );
}
