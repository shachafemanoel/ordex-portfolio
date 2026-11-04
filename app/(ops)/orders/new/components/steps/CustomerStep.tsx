import { useOrderWizard } from '@/app/(ops)/orders/new/components/OrderWizardContext';
import { StepChecklist } from '@/app/(ops)/orders/new/components/StepChecklist';
import {
  CustomerAutocomplete,
  type CustomerSearchResult,
} from '@/components/orders/shared/CustomerAutocomplete';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import { useToast } from '@/components/ui/ToastProvider';
import { useCreateCustomerMutation } from '@/lib/hooks/useQuery';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { useCallback, useState } from 'react';

// Helper for address validation
async function validateAddressAPI(data: { city: string; street: string; number: string }) {
  const res = await fetch('/api/maps/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: {
        regionCode: 'IL',
        locality: data.city,
        addressLines: [`${data.street} ${data.number}`],
      },
    }),
  });
  if (!res.ok) throw new Error('Validation failed');
  return res.json();
}

interface AddressComponent {
  componentType: string;
  componentName: { text: string };
}

interface QuickCustomerFormState {
  name: string;
  email: string;
  phone: string;
  city: string;
  street: string;
  number: string;
  floor: string;
  apartment: string;
  notes: string;
  lat?: number;
  lng?: number;
}

const initialQuickCustomer: QuickCustomerFormState = {
  name: '',
  email: '',
  phone: '',
  city: '',
  street: '',
  number: '',
  floor: '',
  apartment: '',
  notes: '',
  lat: undefined,
  lng: undefined,
};

interface AddressFormData {
  billing: {
    street: string;
    city: string;
    number: string;
    floor: string;
    apartment: string;
    notes: string;
    lat?: number;
    lng?: number;
  };
  shipping: {
    street: string;
    city: string;
    number: string;
    floor: string;
    apartment: string;
    notes: string;
    lat?: number;
    lng?: number;
  };
  same_as_billing: boolean;
}

const initialAddressData: AddressFormData = {
  billing: { street: '', city: '', number: '', floor: '', apartment: '', notes: '' },
  shipping: { street: '', city: '', number: '', floor: '', apartment: '', notes: '' },
  same_as_billing: true,
};

function AddressFormModal({
  isOpen,
  onClose,
  customer,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: { id: string; name: string };
  onSuccess: (updatedCustomer: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    addresses?: any[];
  }) => void;
}) {
  const { t, direction } = useUITranslation();
  const [formData, setFormData] = useState<AddressFormData>(initialAddressData);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState<'billing' | 'shipping' | null>(null);
  const toast = useToast();

  const updateSubField = (section: 'billing' | 'shipping', field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const handleValidate = async (section: 'billing' | 'shipping') => {
    const data = formData[section];
    if (!data.city || !data.street || !data.number) {
      toast.warning(t('orders.new.customer.toast.validateAddressMissingFields'));
      return;
    }

    setValidating(section);
    try {
      const result = await validateAddressAPI(data);
      if (result.success && result.data) {
        const { address, geocode } = result.data;

        // Parse components
        const city =
          address.addressComponents.find((c: AddressComponent) => c.componentType === 'locality')
            ?.componentName.text || data.city;
        const street =
          address.addressComponents.find((c: AddressComponent) => c.componentType === 'route')
            ?.componentName.text || data.street;
        const number =
          address.addressComponents.find(
            (c: AddressComponent) => c.componentType === 'street_number'
          )?.componentName.text || data.number;

        updateSubField(section, 'city', city);
        updateSubField(section, 'street', street);
        updateSubField(section, 'number', number);

        if (geocode.location) {
          updateSubField(section, 'lat', geocode.location.latitude);
          updateSubField(section, 'lng', geocode.location.longitude);
        }

        toast.success(t('orders.new.customer.toast.addressValidatedAndCorrected'));
      }
    } catch (e) {
      toast.error(t('orders.new.customer.toast.addressValidationFailed'));
      console.error(e);
    } finally {
      setValidating(null);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.billing.city || !formData.billing.street || !formData.billing.number) {
      toast.warning(t('orders.new.customer.toast.billingRequired'));
      return;
    }
    if (
      !formData.same_as_billing &&
      (!formData.shipping.city || !formData.shipping.street || !formData.shipping.number)
    ) {
      toast.warning(t('orders.new.customer.toast.shippingRequired'));
      return;
    }

    setLoading(true);
    try {
      const shippingAddress = formData.same_as_billing ? formData.billing : formData.shipping;

      const response = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingAddress: formData.billing,
          shippingAddress,
        }),
      });

      if (!response.ok) {
        throw new Error(t('orders.new.customer.toast.updateAddressesFailed'));
      }

      const result = await response.json();
      toast.success(t('orders.new.customer.toast.addressesUpdated'));
      onSuccess(result.data || result);
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('orders.new.customer.toast.updateAddressesFailed')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.new.customer.addressModal.title', undefined, {
        params: { name: customer.name },
      })}
      maxWidth="2xl"
    >
      <div className="space-y-6 py-2" dir={direction}>
        {/* Billing Section */}
        <section className="space-y-4">
          <h4 className="font-bold border-b pb-1 text-ordex-primary">
            {t('orders.new.customer.addressModal.billingTitle')}
          </h4>

          <div className="tone-info p-3 rounded-lg">
            <Label className="text-xs font-bold text-primary-700 mb-2 block">
              {t('orders.new.customer.addressModal.quickSearch')}
            </Label>
            <PlacesAutocomplete
              onAddressSelect={(addr) => {
                console.log('🗺️ [Billing] Address selected:', addr);
                updateSubField('billing', 'city', addr.city || '');
                updateSubField('billing', 'street', addr.street || '');
                updateSubField('billing', 'number', addr.streetNumber || '');
                if (addr.lat) updateSubField('billing', 'lat', Number(addr.lat));
                if (addr.lng) updateSubField('billing', 'lng', Number(addr.lng));
                console.log('✅ [Billing] Updated:', {
                  city: addr.city,
                  street: addr.street,
                  number: addr.streetNumber,
                });
              }}
              className="bg-surface border-primary-200 focus:ring-primary/20"
            />
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleValidate('billing')}
                disabled={validating === 'billing'}
                className="text-xs h-7 bg-primary-100 hover:bg-primary-200 text-primary-700"
              >
                {validating === 'billing'
                  ? t('orders.new.customer.addressModal.validating')
                  : t('orders.new.customer.addressModal.validateManually')}
              </Button>
            </div>
            {formData.billing.city && formData.billing.street && (
              <div className="mt-2 flex items-center gap-2 text-sm rounded border border-subtle bg-surface-muted p-2 text-fg-muted">
                <span className="text-lg">📍</span>
                <span className="font-bold text-fg">
                  {t('orders.new.customer.addressModal.addressSelected')}
                </span>
                <span>
                  {formData.billing.street} {formData.billing.number}, {formData.billing.city}
                </span>
                <span className="mr-auto text-success font-black">
                  {t('orders.new.customer.addressModal.saved')}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="space-y-1">
              <Label className="text-xs">{t('form.floor')}</Label>
              <Input
                value={formData.billing.floor}
                onChange={(e) => updateSubField('billing', 'floor', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('form.apartment')}</Label>
              <Input
                value={formData.billing.apartment}
                onChange={(e) => updateSubField('billing', 'apartment', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('form.notes')}</Label>
              <Input
                value={formData.billing.notes}
                onChange={(e) => updateSubField('billing', 'notes', e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Sync Checkbox */}
        <div className="flex items-center gap-2 bg-ordex-bg-soft p-3 rounded-lg border">
          <input
            type="checkbox"
            id="same_as_billing"
            checked={formData.same_as_billing}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, same_as_billing: e.target.checked }))
            }
            className="h-4 w-4 rounded border-subtle text-ordex-primary focus:ring-primary/20"
          />
          <Label htmlFor="same_as_billing" className="cursor-pointer font-medium">
            {t('orders.new.customer.addressModal.sameAsBilling')}
          </Label>
        </div>

        {/* Shipping Section (Optional) */}
        {!formData.same_as_billing && (
          <section className="space-y-4 animate-in slide-in-from-top-2 duration-200">
            <h4 className="font-bold border-b pb-1 text-ordex-primary">
              {t('orders.new.customer.addressModal.shippingTitle')}
            </h4>

            <div className="tone-info p-3 rounded-lg">
              <Label className="text-xs font-bold text-primary-700 mb-2 block">
                {t('orders.new.customer.addressModal.quickSearch')}
              </Label>
              <PlacesAutocomplete
                onAddressSelect={(addr) => {
                  console.log('🗺️ [Shipping] Address selected:', addr);
                  updateSubField('shipping', 'city', addr.city || '');
                  updateSubField('shipping', 'street', addr.street || '');
                  updateSubField('shipping', 'number', addr.streetNumber || '');
                  if (addr.lat) updateSubField('shipping', 'lat', Number(addr.lat));
                  if (addr.lng) updateSubField('shipping', 'lng', Number(addr.lng));
                  console.log('✅ [Shipping] Updated:', {
                    city: addr.city,
                    street: addr.street,
                    number: addr.streetNumber,
                  });
                }}
                className="bg-surface border-primary-200 focus:ring-primary/20"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleValidate('shipping')}
                  disabled={validating === 'shipping'}
                  className="text-xs h-7 bg-primary-100 hover:bg-primary-200 text-primary-700"
                >
                  {validating === 'shipping'
                    ? t('orders.new.customer.addressModal.validating')
                    : t('orders.new.customer.addressModal.validateManually')}
                </Button>
              </div>
              {formData.shipping.city && formData.shipping.street && (
                <div className="mt-2 flex items-center gap-2 text-sm rounded border border-subtle bg-surface-muted p-2 text-fg-muted">
                  <span className="text-lg">📍</span>
                  <span className="font-bold text-fg">
                    {t('orders.new.customer.addressModal.addressSelected')}
                  </span>
                  <span>
                    {formData.shipping.street} {formData.shipping.number}, {formData.shipping.city}
                  </span>
                  <span className="mr-auto text-success font-black">
                    {t('orders.new.customer.addressModal.saved')}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="space-y-1">
                <Label className="text-xs">{t('form.floor')}</Label>
                <Input
                  value={formData.shipping.floor}
                  onChange={(e) => updateSubField('shipping', 'floor', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('form.apartment')}</Label>
                <Input
                  value={formData.shipping.apartment}
                  onChange={(e) => updateSubField('shipping', 'apartment', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('form.notes')}</Label>
                <Input
                  value={formData.shipping.notes}
                  onChange={(e) => updateSubField('shipping', 'notes', e.target.value)}
                />
              </div>
            </div>
          </section>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="min-w-[120px]">
            {loading
              ? t('orders.new.customer.addressModal.saving')
              : t('orders.new.customer.addressModal.updateAddresses')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CustomerStep() {
  const { t, direction } = useUITranslation();
  const { state, setCustomer, goNext, dispatch } = useOrderWizard();
  const toast = useToast();

  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [validating, setValidating] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState<QuickCustomerFormState>(initialQuickCustomer);
  const [errors, setErrors] = useState<Partial<Record<keyof QuickCustomerFormState, string>>>({});

  const createCustomerMutation = useCreateCustomerMutation({
    onSuccess: (createdCustomer) => {
      toast.success(t('orders.new.customer.toast.customerCreated'));
      setCustomer({
        id: createdCustomer.id,
        name: createdCustomer.name,
        email: createdCustomer.email,
        phone: createdCustomer.phone,
        addresses: createdCustomer.addresses || [],
      });
      setShowQuickCreate(false);
      setQuickCustomer(initialQuickCustomer);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('orders.new.customer.toast.customerCreateFailed'));
    },
  });

  const handleCustomerSelect = useCallback(
    (customer: CustomerSearchResult) => {
      setCustomer({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        addresses: customer.addresses || [],
      });
    },
    [setCustomer]
  );

  const handleQuickCreateChange = (field: keyof QuickCustomerFormState, value: any) => {
    setQuickCustomer((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleValidateQuick = async () => {
    if (!quickCustomer.city || !quickCustomer.street || !quickCustomer.number) {
      toast.warning(t('orders.new.customer.toast.validateAddressMissingFields'));
      return;
    }

    setValidating(true);
    try {
      const result = await validateAddressAPI(quickCustomer);
      if (result.success && result.data) {
        const { address, geocode } = result.data;

        const city =
          address.addressComponents.find((c: AddressComponent) => c.componentType === 'locality')
            ?.componentName.text || quickCustomer.city;
        const street =
          address.addressComponents.find((c: AddressComponent) => c.componentType === 'route')
            ?.componentName.text || quickCustomer.street;
        const number =
          address.addressComponents.find(
            (c: AddressComponent) => c.componentType === 'street_number'
          )?.componentName.text || quickCustomer.number;

        handleQuickCreateChange('city', city);
        handleQuickCreateChange('street', street);
        handleQuickCreateChange('number', number);

        if (geocode.location) {
          handleQuickCreateChange('lat', geocode.location.latitude);
          handleQuickCreateChange('lng', geocode.location.longitude);
        }

        toast.success(t('orders.new.customer.toast.addressValidated'));
      }
    } catch (e) {
      toast.error(t('orders.new.customer.toast.addressValidationFailed'));
      console.error(e);
    } finally {
      setValidating(false);
    }
  };

  const handleCreateCustomer = () => {
    const newErrors: Partial<Record<keyof QuickCustomerFormState, string>> = {};
    if (!quickCustomer.name.trim()) newErrors.name = t('orders.new.customer.requiredField');
    if (!quickCustomer.phone.trim()) newErrors.phone = t('orders.new.customer.requiredField');
    if (!quickCustomer.city.trim()) newErrors.city = t('orders.new.customer.requiredField');
    if (!quickCustomer.street.trim()) newErrors.street = t('orders.new.customer.requiredField');
    if (!quickCustomer.number.trim()) newErrors.number = t('orders.new.customer.requiredField');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.warning(t('orders.new.customer.toast.fillRequired'));
      return;
    }

    const payload = {
      name: quickCustomer.name.trim(),
      email: quickCustomer.email.trim() || undefined,
      phone: quickCustomer.phone.trim() || undefined,
      billingAddress: {
        city: quickCustomer.city.trim(),
        street: quickCustomer.street.trim(),
        number: quickCustomer.number.trim(),
        floor: quickCustomer.floor.trim() || undefined,
        apartment: quickCustomer.apartment.trim() || undefined,
        notes: quickCustomer.notes.trim() || undefined,
        lat: quickCustomer.lat,
        lng: quickCustomer.lng,
      },
      shippingAddress: {
        city: quickCustomer.city.trim(),
        street: quickCustomer.street.trim(),
        number: quickCustomer.number.trim(),
        floor: quickCustomer.floor.trim() || undefined,
        apartment: quickCustomer.apartment.trim() || undefined,
        notes: quickCustomer.notes.trim() || undefined,
        lat: quickCustomer.lat,
        lng: quickCustomer.lng,
      },
    };

    createCustomerMutation.mutate(payload);
  };

  const handleClearCustomer = () => {
    setCustomer(null);
  };

  const billingAddress = state.customer?.addresses?.find((a) => a.type === 'BILLING');
  const shippingAddress = state.customer?.addresses?.find((a) => a.type === 'SHIPPING');

  const canProceed = !!(state.customer && state.billingAddressId && state.shippingAddressId);
  const checklistItems = [
    {
      id: 'customer',
      label: t('orders.new.customer.checklist.customerSelected'),
      done: !!state.customer,
    },
    {
      id: 'billing-address',
      label: t('orders.new.customer.checklist.billingSelected'),
      done: !!state.billingAddressId,
    },
    {
      id: 'shipping-address',
      label: t('orders.new.customer.checklist.shippingSelected'),
      done: !!state.shippingAddressId,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-7" dir={direction}>
      <StepChecklist
        title={t('orders.new.customer.checklist.title')}
        items={checklistItems}
        className="bg-surface"
      />
      {/* Customer Selection Card */}
      <section className="bg-surface rounded-xl border border-subtle overflow-visible shadow-sm transition-all duration-300">
        <div className="p-6 border-b border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-4 items-center">
            <div
              className={cn(
                'size-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300',
                state.customer
                  ? 'bg-primary text-on-dark shadow-lg shadow-primary/30'
                  : 'bg-primary/10 text-primary'
              )}
            >
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-fg">{t('orders.new.step.customer')}</h3>
              <p className="text-sm text-fg-muted">{t('orders.new.customer.subtitle')}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (showQuickCreate) {
                setShowQuickCreate(false);
                setQuickCustomer(initialQuickCustomer);
              } else {
                setShowQuickCreate(true);
                setCustomer(null);
              }
            }}
            className="text-primary font-bold hover:bg-primary/5"
          >
            {showQuickCreate
              ? t('orders.new.customer.backToSearch')
              : t('orders.new.customer.newCustomer')}
          </Button>
        </div>

        <div className="p-6">
          {!showQuickCreate ? (
            <div className="space-y-6">
              <div className="relative z-[120] group max-w-2xl">
                <CustomerAutocomplete
                  onSelect={handleCustomerSelect}
                  selectedCustomerName={state.customer?.name}
                  autoFocus
                />
              </div>

              {state.customer && (
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 p-4 sm:p-6 bg-surface-muted/50 border border-subtle rounded-xl animate-in fade-in slide-in-from-top-2">
                  <div className="flex gap-4">
                    <div className="size-12 rounded-full bg-surface border border-subtle flex items-center justify-center text-primary font-black text-xl shadow-sm">
                      {state.customer.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-fg mb-1">
                        {state.customer.name}
                      </h4>
                      <p className="text-sm text-fg-muted">
                        {state.customer.email} • {state.customer.phone}
                      </p>
                      <div className="mt-2 flex gap-3">
                        {billingAddress && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-fg-muted bg-surface px-2 py-1 rounded border border-subtle">
                            <MapPin className="w-3.5 h-3.5 text-fg-subtle" />
                            {billingAddress.street} {billingAddress.number}, {billingAddress.city}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleClearCustomer}
                    className="text-primary text-sm font-bold hover:underline sm:self-start"
                  >
                    {t('orders.new.customer.replace')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="grid gap-8 md:grid-cols-2 bg-surface-muted/30 p-6 rounded-xl border border-subtle">
                {/* Quick create fields... keep simplified but styled */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-fg-muted mb-1.5 block">
                      {t('orders.new.customer.fullNameRequired')}
                    </Label>
                    <Input
                      value={quickCustomer.name}
                      onChange={(e) => handleQuickCreateChange('name', e.target.value)}
                      className="h-11 rounded-lg border-subtle"
                      placeholder={t('form.fullNamePlaceholder')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-bold text-fg-muted mb-1.5 block">
                        {t('orders.new.customer.phoneRequired')}
                      </Label>
                      <Input
                        value={quickCustomer.phone}
                        onChange={(e) => handleQuickCreateChange('phone', e.target.value)}
                        className="h-11 rounded-lg border-subtle"
                        placeholder="05..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-fg-muted mb-1.5 block">
                        {t('form.email')}
                      </Label>
                      <Input
                        value={quickCustomer.email}
                        onChange={(e) => handleQuickCreateChange('email', e.target.value)}
                        className="h-11 rounded-lg border-subtle"
                        placeholder="mail@example.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-xs font-bold text-fg-muted mb-1.5 block">
                    {t('orders.new.customer.shippingAddressRequired')}
                  </Label>
                  <PlacesAutocomplete
                    onAddressSelect={(addr) => {
                      handleQuickCreateChange('city', addr.city || '');
                      handleQuickCreateChange('street', addr.street || '');
                      handleQuickCreateChange('number', addr.streetNumber || '');
                      if (addr.lat) handleQuickCreateChange('lat', addr.lat);
                      if (addr.lng) handleQuickCreateChange('lng', addr.lng);
                    }}
                    className="h-11 border-subtle"
                  />
                  {quickCustomer.city && quickCustomer.street && (
                    <div className="mt-2 flex items-center gap-2 text-sm rounded border border-subtle bg-surface-muted p-2 text-fg-muted">
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <span className="font-medium text-fg">
                        {quickCustomer.street} {quickCustomer.number}, {quickCustomer.city}
                      </span>
                      {quickCustomer.lat && quickCustomer.lng ? (
                        <span className="mr-auto text-success font-bold text-xs">✓ מאומת</span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleValidateQuick}
                          disabled={validating}
                          className="mr-auto text-xs h-6 px-2 bg-primary-100 hover:bg-primary-200 text-primary-700"
                        >
                          {validating ? 'מאמת...' : 'אמת כתובת'}
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      placeholder={t('form.city')}
                      value={quickCustomer.city}
                      onChange={(e) => handleQuickCreateChange('city', e.target.value)}
                    />
                    <Input
                      placeholder={t('form.street')}
                      value={quickCustomer.street}
                      onChange={(e) => handleQuickCreateChange('street', e.target.value)}
                    />
                    <Input
                      placeholder={t('orders.new.customer.numberPlaceholder')}
                      value={quickCustomer.number}
                      onChange={(e) => handleQuickCreateChange('number', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Input
                      placeholder={t('form.floor')}
                      value={quickCustomer.floor}
                      onChange={(e) => handleQuickCreateChange('floor', e.target.value)}
                    />
                    <Input
                      placeholder={t('form.apartment')}
                      value={quickCustomer.apartment}
                      onChange={(e) => handleQuickCreateChange('apartment', e.target.value)}
                    />
                  </div>
                  <div className="mt-2">
                    <Input
                      placeholder={t('orders.new.customer.notesPlaceholder')}
                      value={quickCustomer.notes}
                      onChange={(e) => handleQuickCreateChange('notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={handleCreateCustomer} disabled={createCustomerMutation.isPending}>
                  {createCustomerMutation.isPending
                    ? t('orders.new.customer.creating')
                    : t('orders.new.customer.saveAndContinue')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* Sticky Footer for Actions — z-[1032] to appear above mobile bottom nav (z-1030) */}
      <div className="fixed bottom-0 left-0 right-0 z-[1032] bg-surface-translucent-strong backdrop-blur-md border-t border-subtle p-3 sm:p-4">
        <div className="max-w-[960px] mx-auto flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3">
          <Button variant="ghost" className="font-bold text-fg-muted w-full sm:w-auto">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={goNext}
            disabled={!canProceed}
            className="px-6 sm:px-12 h-12 rounded-lg bg-primary text-on-dark font-bold hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <span>{t('orders.new.customer.continueToProducts')}</span>
            <span className="material-symbols-outlined text-sm">arrow_left</span>
          </Button>
        </div>
      </div>
      <div className="h-20" /> {/* Spacer for sticky footer */}
      {state.customer && (
        <AddressFormModal
          isOpen={showAddressModal}
          onClose={() => setShowAddressModal(false)}
          customer={state.customer}
          onSuccess={(updated) => {
            setCustomer({
              id: updated.id,
              name: updated.name,
              email: updated.email,
              phone: updated.phone,
              addresses: updated.addresses || [],
            });
          }}
        />
      )}
    </div>
  );
}
