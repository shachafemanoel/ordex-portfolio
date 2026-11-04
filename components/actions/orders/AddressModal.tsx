import { OrderModalStepHeader } from '@/components/orders/shared/OrderModalStepHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { getMapboxPublicToken, hasMapboxToken } from '@/lib/mapbox/client';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { Order } from '@/lib/types';
import { AddressAutofill } from '@mapbox/search-js-react';
import { MapPin } from 'lucide-react';
import { useState } from 'react';

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: Order;
  onConfirm: (payload: any) => Promise<void>;
  title?: string;
  description?: string;
}

export function AddressModal({
  isOpen,
  onClose,
  entity,
  onConfirm,
  title,
  description,
}: AddressModalProps) {
  const address = entity.shippingAddress || ({} as any);
  const [city, setCity] = useState(address.city || entity.city || '');
  const [street, setStreet] = useState(address.street || entity.street || '');
  const [number, setNumber] = useState(address.number || entity.houseNumber || '');
  const [floor, setFloor] = useState(address.floor || entity.floor || '');
  const [apartment, setApartment] = useState(address.apartment || entity.apartment || '');
  const [notes, setNotes] = useState(address.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lat, setLat] = useState<number | null>(address.lat || null);
  const [lng, setLng] = useState<number | null>(address.lng || null);
  const [formattedAddress, setFormattedAddress] = useState<string | null>(
    address.formattedAddress || null
  );
  const [placeId, setPlaceId] = useState<string | null>(address.placeId || null);

  const handleRetrieve = (res: any) => {
    if (res?.features && res.features.length > 0) {
      const feature = res.features[0];
      setLat(feature.geometry.coordinates[1]);
      setLng(feature.geometry.coordinates[0]);
      setFormattedAddress(feature.properties.full_address || feature.properties.place_name);
      setPlaceId(feature.properties.mapbox_id);
      setCity(feature.properties.context?.place?.name || feature.properties.place || '');
      setStreet(feature.properties.address || feature.properties.text || '');
      setNumber(feature.properties.address_number || '');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        city,
        street,
        number,
        floor,
        apartment,
        notes,
        lat,
        lng,
        formattedAddress,
        placeId,
      };
      await onConfirm(payload);
      onClose();
    } catch (e) {
      // Error handled by runner
    } finally {
      setIsSubmitting(false);
    }
  };

  // Address editing typically happens at order intake (RECEIVED) or preparation
  const currentStatus = entity.status ? normalizeOrderStatus(String(entity.status)) : 'RECEIVED';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || 'עדכון כתובת'} maxWidth="md">
      <div className="space-y-4" dir="rtl">
        {/* Step context – address is part of order intake / RECEIVED step */}
        <OrderModalStepHeader
          currentStatus={currentStatus}
          description="עדכון כתובת המשלוח / ההתקנה של ההזמנה"
        />

        {description && <p className="text-gray-500 text-sm">{description}</p>}

        {/* Responsive form grid: stacks on mobile, 2-col on tablet+ */}
        <div className="form-grid">
          {hasMapboxToken() ? (
            <div className="col-span-full mb-4">
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" /> חיפוש כתובת
              </label>
              <AddressAutofill accessToken={getMapboxPublicToken()} onRetrieve={handleRetrieve}>
                <Input
                  autoComplete="address-line1"
                  placeholder="התחל להקליד כתובת לחיפוש..."
                  className="w-full text-right"
                  dir="rtl"
                />
              </AddressAutofill>
            </div>
          ) : null}

          <div className="form-grid-full">
            <label className="block text-sm font-medium mb-1.5">עיר</label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="בחר עיר"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">רחוב</label>
            <Input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              required
              placeholder="שם הרחוב"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">מספר</label>
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
              placeholder="מס׳ בית"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">קומה</label>
            <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="קומה" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">דירה</label>
            <Input
              value={apartment}
              onChange={(e) => setApartment(e.target.value)}
              placeholder="דירה"
            />
          </div>

          <div className="form-grid-full">
            <label className="block text-sm font-medium mb-1.5">הערות לכתובת</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הנחיות הגעה, קוד כניסה וכו׳"
            />
          </div>
        </div>

        {/* Footer – full-width stacked on mobile */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto sm:h-10"
          >
            ביטול
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="lg"
            className="w-full sm:w-auto sm:h-10"
          >
            שמור
          </Button>
        </div>
      </div>
    </Modal>
  );
}
