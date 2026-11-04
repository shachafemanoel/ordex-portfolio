'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

export interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  basePriceCents: number | null;
  stock: number;
  reorderLevel: number;
  isActive: boolean;
  inventoryEnabled: boolean;
  type: string;
  imageUrl?: string | null;
  defaultSupplier?: { id: string; name: string } | null;
}

interface ProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess: () => void;
}

interface Supplier {
  id: string;
  name: string;
}

export function ProductDialog({ isOpen, onClose, product, onSuccess }: ProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    basePrice: '',
    stock: 0,
    reorderLevel: 0,
    isActive: true,
    inventoryEnabled: true,
    type: 'SIMPLE',
    imageUrl: '',
    description: '',
    defaultSupplierId: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetch('/api/suppliers?limit=100')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSuppliers(data.data.items);
          }
        })
        .catch(console.error);

      if (product) {
        setFormData({
          name: product.name,
          sku: product.sku,
          basePrice: product.basePriceCents ? (product.basePriceCents / 100).toFixed(2) : '',
          stock: product.stock,
          reorderLevel: product.reorderLevel,
          isActive: product.isActive,
          inventoryEnabled: product.inventoryEnabled,
          type: product.type,
          imageUrl: product.imageUrl || '',
          description: product.description || '',
          defaultSupplierId: product.defaultSupplier?.id || '',
        });
      } else {
        setFormData({
          name: '',
          sku: '',
          basePrice: '',
          stock: 0,
          reorderLevel: 0,
          isActive: true,
          inventoryEnabled: true,
          type: 'SIMPLE',
          imageUrl: '',
          description: '',
          defaultSupplierId: '',
        });
      }
    }
  }, [isOpen, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        sku: formData.sku,
        basePriceCents: formData.basePrice
          ? Math.round(parseFloat(formData.basePrice) * 100)
          : null,
        demoStock: Number(formData.stock),
        reorderLevel: Number(formData.reorderLevel),
        isActive: formData.isActive,
        inventoryEnabled: formData.inventoryEnabled,
        type: formData.type,
        imageUrl: formData.imageUrl || null,
        description: formData.description || null,
        defaultSupplierId: formData.defaultSupplierId || null,
      };

      const url = product ? `/api/products/${product.id}` : '/api/products';
      const method = product ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Operation failed');
      }

      toast.success(product ? 'המוצר עודכן בהצלחה' : 'המוצר נוצר בהצלחה');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירת המוצר');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{product ? 'עריכת מוצר' : 'מוצר חדש'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">שם המוצר</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">תיאור</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">URL של תמונה</label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">SKU</label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">סוג</label>
              <Select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                options={[
                  { value: 'SIMPLE', label: 'רגיל' },
                  { value: 'BUNDLE', label: 'חבילה' },
                  { value: 'SERVICE', label: 'שירות' },
                ]}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">מחיר בסיס (₪)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">ספק</label>
              <Select
                value={formData.defaultSupplierId}
                onChange={(e) => setFormData({ ...formData, defaultSupplierId: e.target.value })}
                options={[
                  { value: '', label: 'ללא ספק' },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">מלאי התחלתי</label>
              <Input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">נקודת הזמנה מחדש</label>
              <Input
                type="number"
                value={formData.reorderLevel}
                onChange={(e) =>
                  setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-8 py-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <span className="text-sm">פעיל</span>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.inventoryEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, inventoryEnabled: checked })
                }
              />
              <span className="text-sm">ניהול מלאי</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'שומר...' : product ? 'עדכן' : 'צור'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
