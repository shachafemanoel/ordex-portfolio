import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { WORKFLOW_TABS } from './constants';

interface OpsTimelineProps {
  currentIndex: number;
  completedSteps: boolean[];
  onStepClick: (index: number) => void;
}

export default function OpsTimeline({
  currentIndex,
  completedSteps,
  onStepClick,
}: OpsTimelineProps) {
  return (
    <div className="flex items-center justify-between px-2 py-3 sm:px-6">
      {WORKFLOW_TABS.map((step, i) => {
        const isCompleted = completedSteps[i];
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        return (
          <React.Fragment key={step.key}>
            {i > 0 && (
              <div className="flex-1 mx-1">
                <div
                  className={cn(
                    'h-0.5 rounded-full transition-colors duration-300',
                    isCompleted || isPast ? 'bg-teal-500' : 'bg-slate-200'
                  )}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => onStepClick(i)}
              className={cn(
                'flex flex-col items-center gap-1 transition-all duration-300 group',
                'min-w-[56px] sm:min-w-[72px]'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 transition-all duration-300',
                  isCompleted
                    ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                    : isCurrent
                      ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-200 animate-pulse'
                      : 'bg-white border-slate-200 text-slate-400 group-hover:border-slate-300'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.icon}
              </div>
              <span
                className={cn(
                  'text-[10px] sm:text-xs font-medium transition-colors',
                  isCompleted
                    ? 'text-teal-700'
                    : isCurrent
                      ? 'text-teal-700 font-bold'
                      : 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
