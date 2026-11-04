'use client';

import { EntityBadge, type EntityTone } from '@/components/shared/display/EntityPrimitives';
import { Calendar, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrderOpsForm } from '../formTypes';

type ActiveForm = null | OrderOpsForm;

interface ActionButtonsProps {
  onSelectForm: (form: ActiveForm) => void;
}

const ACTIONS = [
  {
    form: 'schedule' as const,
    label: 'קביעת מועד אספקה',
    description: 'הפעולה הראשית לקביעת המועד ולאישור התיאום מול הלקוח',
    icon: Calendar,
    tone: 'info' as const,
  },
  {
    form: 'ready' as const,
    label: 'סטטוס פריטים',
    description: 'עדכון האם כל פריט זמין במלאי או ממתין לאספקה',
    icon: PackageCheck,
    tone: 'neutral' as const,
  },
];

function getActionToneClasses(tone: EntityTone) {
  switch (tone) {
    case 'info':
      return {
        button: 'border-primary-100 bg-[#f8fbff] text-primary-600 hover:bg-primary-50',
        iconTone: 'bg-primary-50 text-primary-500',
        badgeTone: 'info' as const,
      };
    case 'neutral':
    default:
      return {
        button: 'border-slate-200 bg-white text-[#34517a] hover:bg-[#f8fbff]',
        iconTone: 'bg-[#f3f7fd] text-[#5f7493]',
        badgeTone: 'neutral' as const,
      };
  }
}

export function ActionButtons({ onSelectForm }: ActionButtonsProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">פעולות מהירות</h3>
          <p className="text-[11px] text-slate-500">המיקוד כאן הוא רק תפעול פריטים ותיאום אספקה.</p>
        </div>
      </div>

      <div className="space-y-2">
        {ACTIONS.map((action, index) => {
          const tone = getActionToneClasses(action.tone);

          return (
            <button
              key={action.form}
              type="button"
              onClick={() => onSelectForm(action.form)}
              className={cn(
                'flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-right transition-all active:scale-[0.98]',
                index === 0 ? 'min-h-[78px] shadow-[0_12px_24px_-18px_rgba(0,133,255,0.4)]' : 'min-h-[68px]',
                tone.button
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                  tone.iconTone
                )}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-black">{action.label}</div>
                  <EntityBadge
                    label={index === 0 ? 'מומלץ' : 'עדכון'}
                    tone={tone.badgeTone}
                    size="sm"
                  />
                </div>
                <div className="text-[11px] leading-4 opacity-85">{action.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
