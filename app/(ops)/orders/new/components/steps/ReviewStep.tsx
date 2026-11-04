'use client';

import { OrderItemsTable } from '@/components/orders/details/OrderItemsTable';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { useCreateOrderMutation } from '@/lib/hooks/useQuery';
import { cn } from '@/lib/utils';
import type { OrderCreateInput } from '@/lib/validators/order';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Send as SendIcon,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StepChecklist } from '@/app/(ops)/orders/new/components/StepChecklist';
import { useOrderWizard } from '@/app/(ops)/orders/new/components/OrderWizardContext';

export function ReviewStep() {
  const { state, goBack, goToStep, totalCents, dispatch, wizardSessionStartedAtMs } =
    useOrderWizard();
  const toast = useToast();
  const { t, direction } = useUITranslation();
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'CASH' | 'INVOICE'>(
    'CREDIT_CARD'
  );

  const createOrderMutation = useCreateOrderMutation({
    onError: (error: Error) => {
      toast.error(error.message || t('orders.new.review.toast.createError'));
    },
  });

  const zeroPriceItems = state.items.filter((item) => item.priceCents <= 0);
  const hasInvalidItemPrices = zeroPriceItems.length > 0;
  const checklistItems = [
    {
      id: 'customer-selected',
      label: t('orders.new.review.checklist.customer'),
      done: !!state.customer && !!state.billingAddressId && !!state.shippingAddressId,
    },
    {
      id: 'items-valid',
      label: t('orders.new.review.checklist.items'),
      done: state.items.length > 0 && !hasInvalidItemPrices,
    },
    {
      id: 'payment-selected',
      label: t('orders.new.review.checklist.payment'),
      done: !!paymentMethod,
    },
  ];

  const handleSubmit = async () => {
    if (!state.customer) return;
    if (hasInvalidItemPrices) {
      toast.error(t('orders.new.review.toast.invalidPrices'));
      goToStep('products');
      return;
    }

    dispatch({ type: 'SET_SUBMITTING', isSubmitting: true });

    // Map UI payment method to valid backend enum value
    // 'INVOICE' is a UI concept (pay-later) mapped to 'OTHER' with PENDING status
    const backendPaymentMethod =
      paymentMethod === 'INVOICE' ? ('OTHER' as const) : paymentMethod;

    const wizardMs = Date.now() - wizardSessionStartedAtMs;
    const payload: OrderCreateInput = {
      customerId: state.customer.id,
      billingAddressId: state.billingAddressId ?? undefined,
      shippingAddressId: state.shippingAddressId ?? undefined,
      notes: state.notes,
      items: state.items.map((item) => ({
        productId: item.productId,
        sku: item.productSku,
        name: item.productName,
        quantity: item.quantity,
        priceCents: item.priceCents,
      })),
      payment: {
        method: backendPaymentMethod,
        amountCents: totalCents,
        status: 'PENDING',
      },
      ...(wizardMs >= 0 && wizardMs <= 3_600_000
        ? { clientInstrumentation: { orderWizardDurationMs: wizardMs } }
        : {}),
    };

    try {
      const result = await createOrderMutation.mutateAsync(payload);
      toast.success(t('orders.new.review.toast.success'));
      router.push(`/orders/${result.id}`);
    } catch (e) {
      // Handled by onError
    } finally {
      dispatch({ type: 'SET_SUBMITTING', isSubmitting: false });
    }
  };

  return (
    <div className="space-y-5 sm:space-y-7 animate-in fade-in duration-500" dir={direction}>
      <StepChecklist
        title={t('orders.new.review.checklist.title')}
        items={checklistItems}
        className="bg-surface"
      />

      {hasInvalidItemPrices && (
        <div className="surface-danger-soft rounded-xl p-4">
          <p className="text-sm font-semibold text-danger">
            {t('orders.new.review.invalidItemsBanner', undefined, {
              params: { count: zeroPriceItems.length },
            })}
          </p>
          <Button
            variant="outline"
            onClick={() => goToStep('products')}
            className="mt-3 border-subtle text-danger hover:bg-surface-muted"
          >
            {t('orders.new.review.backToProducts')}
          </Button>
        </div>
      )}

      {/* Order Summary & Items Preview */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-fg border-b border-subtle pb-2 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary-600" />
          {t('orders.new.review.itemsTitle')}
        </h3>
        <OrderItemsTable
          items={state.items.map((item) => ({
            id: item.id,
            name: item.productName,
            sku: item.productSku,
            quantity: item.quantity,
            unitPrice: item.priceCents / 100,
            totalPrice: (item.quantity * item.priceCents) / 100,
          }))}
        />
      </section>

      {/* Payment Method Selection */}
      <section className="bg-surface rounded-xl border border-subtle shadow-sm overflow-hidden">
        <div className="p-6 border-b border-subtle flex items-center gap-4">
          <div className="size-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-fg">{t('orders.new.review.payment.title')}</h3>
            <p className="text-sm text-fg-muted">{t('orders.new.review.payment.subtitle')}</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'CREDIT_CARD', label: t('orders.new.review.payment.creditCard'), icon: CreditCard },
            { id: 'CASH', label: t('orders.new.review.payment.cash'), icon: Wallet },
            { id: 'INVOICE', label: t('orders.new.review.payment.invoice'), icon: SendIcon },
          ].map((method) => {
            const isSelected = paymentMethod === method.id;
            const MethodIcon = method.icon;
            return (
              <label key={method.id} className="cursor-pointer relative group">
                <input
                  type="radio"
                  name="payment"
                  className="peer sr-only"
                  checked={isSelected}
                  onChange={() => setPaymentMethod(method.id as any)}
                />
                <div className="p-4 rounded-xl border border-subtle bg-surface hover:bg-surface-muted peer-checked:border-primary-600 peer-checked:bg-primary-50/50 peer-checked:ring-1 peer-checked:ring-primary-600 transition-all h-full flex flex-col items-center justify-center gap-3 text-center">
                  <MethodIcon
                    className={cn(
                      'w-8 h-8 transition-colors',
                      isSelected ? 'text-primary-600' : 'text-fg-subtle group-hover:text-fg-muted'
                    )}
                  />
                  <p
                    className={cn(
                      'font-bold text-sm transition-colors',
                      isSelected ? 'text-primary-900' : 'text-fg-muted'
                    )}
                  >
                    {method.label}
                  </p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 peer-checked:opacity-100 text-primary-600 transition-opacity scale-90 peer-checked:scale-100">
                  <CheckCircle2 className="w-5 h-5 fill-primary-50" />
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* Sticky Footer for Actions — z-[1032] to appear above mobile bottom nav (z-1030) */}
      <div className="fixed bottom-0 left-0 right-0 z-[1032] bg-surface-translucent-strong backdrop-blur-md border-t border-subtle p-3 sm:p-4">
        <div className="max-w-[960px] mx-auto flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            className="font-bold text-fg-muted gap-2 w-full sm:w-auto"
          >
            <ArrowRight className="w-5 h-5" />
            <span>{t('common.back')}</span>
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={state.isSubmitting || hasInvalidItemPrices}
            className="px-8 h-12 rounded-lg bg-primary-600 text-on-dark font-bold hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <span>{t('orders.new.review.submit')}</span>
            <Check className="w-5 h-5" />
          </Button>
        </div>
      </div>
      <div className="h-20" />
    </div>
  );
}
