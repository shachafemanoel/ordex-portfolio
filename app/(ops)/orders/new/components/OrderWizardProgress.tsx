'use client';

import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import {
  STEP_LABEL_KEYS,
  STEP_ORDER,
  WizardStep,
  useOrderWizard,
} from '@/app/(ops)/orders/new/components/OrderWizardContext';

interface OrderWizardProgressProps {
  className?: string;
}

export function OrderWizardProgress({ className }: OrderWizardProgressProps) {
  const { t, direction } = useUITranslation();
  const { state, goToStep, canProceedToProducts, canProceedToSummary } = useOrderWizard();
  const currentIndex = STEP_ORDER.indexOf(state.step);
  const progressPercent = Math.round(((currentIndex + 1) / STEP_ORDER.length) * 100);

  const canNavigateToStep = (step: WizardStep): boolean => {
    switch (step) {
      case 'customer':
        return true;
      case 'products':
        return canProceedToProducts;
      case 'summary':
        return canProceedToSummary;
      default:
        return false;
    }
  };

  const handleStepClick = (step: WizardStep) => {
    if (canNavigateToStep(step)) {
      goToStep(step);
    }
  };

  return (
    <div className={cn('w-full', className)} dir={direction}>
      <div className="flex justify-between items-center mb-3 gap-2">
        <span className="text-xs sm:text-sm font-bold text-primary-600">
          {t('orders.new.progress.stepOf', undefined, {
            params: { current: currentIndex + 1, total: STEP_ORDER.length },
          })}
        </span>
        <span className="text-xs sm:text-sm font-medium text-fg-muted">
          {t('orders.new.progress.completed', undefined, { params: { progress: progressPercent } })}
        </span>
      </div>

      <div className="h-2 w-full bg-surface-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary-600 transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex justify-between text-xs font-semibold text-fg-muted uppercase tracking-wider relative z-10 gap-1">
        {STEP_ORDER.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const label = t(STEP_LABEL_KEYS[step]);
          const canNav = canNavigateToStep(step);

          return (
            <button
              key={step}
              onClick={() => handleStepClick(step)}
              disabled={!canNav}
              className={cn(
                'flex items-center gap-2 transition-all duration-200 outline-none rounded-lg p-1',
                isCurrent
                  ? 'text-primary-600 scale-105'
                  : isCompleted
                    ? 'text-primary-600/80'
                    : 'text-fg-subtle',
                canNav && !isCurrent && 'hover:bg-surface-muted hover:text-fg-muted'
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
              ) : isCurrent ? (
                <CircleDot className="w-5 h-5 md:w-6 md:h-6 text-primary-600" />
              ) : (
                <Circle className="w-5 h-5 md:w-6 md:h-6" />
              )}
              <span className={cn('inline-block text-[11px] sm:text-xs', isCurrent && 'font-bold')}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
