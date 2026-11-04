import { cn } from '@/lib/utils';
import { Check, PackageCheck, Truck, Warehouse, Wrench } from 'lucide-react';
import React from 'react';

export type StageStatus = 'completed' | 'current' | 'pending' | 'error';

export interface Stage {
  id: string;
  label: string;
  icon: React.ElementType;
  status: StageStatus;
}

interface SmartStageIndicatorProps {
  stages: Stage[];
  className?: string;
}

export function SmartStageIndicator({ stages, className }: SmartStageIndicatorProps) {
  return (
    <div
      className={cn(
        'w-full shrink-0 border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-2 py-3 sm:px-5 sm:py-4',
        className
      )}
    >
      <div className="relative flex items-start justify-between">
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-200" style={{ zIndex: 0 }} />

        {stages.map((stage, index) => {
          const isActive = stage.status === 'completed' || stage.status === 'current';
          return (
            <div key={stage.id} className="relative flex flex-1 flex-col items-center gap-1.5" style={{ zIndex: 1 }}>
              {/* Connector to previous (colored if active) */}
              {index > 0 && isActive ? (
                <div
                  className="absolute top-4 right-1/2 h-0.5 w-full bg-gradient-to-r from-primary-500 to-primary-600"
                  style={{ zIndex: 0 }}
                />
              ) : null}

              <div
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-300',
                  stage.status === 'completed' &&
                    'border-emerald-500 bg-emerald-500 text-on-dark shadow-md shadow-emerald-500/30',
                  stage.status === 'current' &&
                    'scale-110 border-primary-500 bg-white text-primary-500 shadow-lg shadow-primary-500/25 ring-4 ring-primary-100',
                  stage.status === 'pending' && 'border-slate-200 text-slate-300',
                  stage.status === 'error' && 'border-[#ffd9bf] bg-[#fff1e6] text-[#d45f00] shadow-md shadow-[#ffd9bf]/40'
                )}
              >
                {stage.status === 'completed' ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <stage.icon className="h-3.5 w-3.5" />
                )}
              </div>

              <span
                className={cn(
                  'text-center text-[9px] font-bold leading-tight transition-colors sm:text-[11px]',
                  stage.status === 'completed' && 'text-[#008c39]',
                  stage.status === 'current' && 'text-primary-600',
                  stage.status === 'pending' && 'text-slate-400',
                  stage.status === 'error' && 'text-[#d45f00]'
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Map each order status to a compact operational stage index (0-based, 4 stages total) */
const STATUS_STAGE_INDEX: Record<string, number> = {
  DRAFT: 0,
  TO_DO: 0,
  RECEIVED: 0,
  CALL_BACK: 0,
  PROCESSING: 1,
  CONFIRMED: 1,
  PO_CREATED: 1,
  AWAITING_STOCK: 1,
  PARTIALLY_SUPPLIED: 1,
  READY: 2,
  READY_FOR_INSTALL: 2,
  INSTALL_SCHEDULING: 3,
  AWAITING_INSTALL: 3,
  SCHEDULED: 3,
  IN_TRANSIT: 3,
  INSTALLATION: 3,
  SUPPLIED: 4,
  COMPLETED: 4,
  INVOICED: 4,
};

const STAGE_DEFINITIONS = [
  { id: 'new', label: 'קליטה', icon: Warehouse },
  { id: 'prep', label: 'בהכנה', icon: Wrench },
  { id: 'ready', label: 'מוכן', icon: PackageCheck },
  { id: 'deliver', label: 'משלוח', icon: Truck },
  { id: 'done', label: 'הושלם', icon: Check },
];

/** Build a Stage[] from a raw order status string */
export function buildStagesFromStatus(status: string): Stage[] {
  const currentIdx = STATUS_STAGE_INDEX[status] ?? 0;
  return STAGE_DEFINITIONS.map((def, idx) => ({
    ...def,
    status: idx < currentIdx ? 'completed' : idx === currentIdx ? 'current' : 'pending',
  }));
}

/** Legacy static export kept for any existing callers */
export const SUPPLY_CHAIN_STAGES: Stage[] = buildStagesFromStatus('TO_DO');
