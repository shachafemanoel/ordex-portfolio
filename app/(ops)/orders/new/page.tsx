'use client';

import { ListPageTemplate } from '@/components/layout/ListPageTemplate';
import { Card } from '@/components/ui/card';
import { useEffect } from 'react';
import { OrderWizardProvider, useOrderWizard } from '@/app/(ops)/orders/new/components/OrderWizardContext';
import { OrderWizardProgress } from '@/app/(ops)/orders/new/components/OrderWizardProgress';
import { useRBAC } from '@/hooks/useRBAC';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import {
  CustomerStep,
  ProductsStep,
  ReviewStep,
} from './components/steps';

function OrderWizardContent() {
  const { t } = useUITranslation();
  const { state } = useOrderWizard();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus customer search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        // Only if step is customer
        if (state.step === 'customer') {
          e.preventDefault();
          document.getElementById('customerSearch')?.focus();
        }
      }
      // Ctrl/Cmd + I: Focus product search
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        if (state.step === 'products') {
          e.preventDefault();
          document.getElementById('productSearch')?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.step]);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Progress Indicator */}
      <Card className="overflow-hidden p-4 sm:p-6">
        <OrderWizardProgress />
      </Card>

      {/* Step Content with Animation */}
      <div
        key={state.step}
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        {state.step === 'customer' && <CustomerStep />}
        {state.step === 'products' && <ProductsStep />}
        {state.step === 'summary' && <ReviewStep />}
      </div>
    </div>
  );
}

export default function OrderCreatePage() {
  const { t, direction } = useUITranslation();
  const { hasPermission, loading } = useRBAC();

  if (loading) {
    return <LoadingSpinner fullScreen message="טוען..." />;
  }

  if (!hasPermission('CREATE_ORDERS')) {
    return <AccessDenied />;
  }

  return (
    <main className="mx-auto w-full max-w-[960px]" dir={direction}>
      <ListPageTemplate
        title={t('orders.new.title')}
        description={t('orders.new.description')}
        className="px-3 py-5 sm:px-4 sm:py-8"
      >
        <div className="p-4 sm:p-5">
          <OrderWizardProvider>
            <OrderWizardContent />
          </OrderWizardProvider>
        </div>
      </ListPageTemplate>
    </main>
  );
}
