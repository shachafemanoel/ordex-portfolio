'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import apiClient from '@/lib/apiClient';
import { useCategoriesQuery, useProductsQuery } from '@/lib/hooks/api/products';
import { useSuppliersQuery } from '@/lib/hooks/api/suppliers';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';

const ProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  defaultSupplierId: z.string().optional(),
  basePriceCents: z.string().optional(), // Using string for basic input handling
  demoStock: z.string().optional(),
  type: z.enum(['SIMPLE', 'BUNDLE', 'SERVICE']),
  procurementType: z.enum(['INVENTORY', 'DROPSHIP', 'SPECIAL_ORDER']),
  installationRequired: z.boolean().default(false),
  isDiscountable: z.boolean().default(true),
  categoryIds: z.array(z.string()).optional(),
  bundleItems: z
    .array(
      z.object({
        childId: z.string(),
        childName: z.string(), // Helper for UI
        quantity: z.number().min(1),
      })
    )
    .optional(),
});

type ProductFormData = z.infer<typeof ProductSchema>;

interface ProductFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: any; // To support edit mode later
}

export function ProductForm({ onSuccess, onCancel, initialData }: ProductFormProps) {
  const { toast } = useToast();
  const [productSearch, setProductSearch] = useState('');
  const suppliersQuery = useSuppliersQuery({ limit: 100 });
  const suppliers = suppliersQuery.data?.items ?? [];
  const categoriesQuery = useCategoriesQuery();
  const categories: any[] = categoriesQuery.data?.items ?? [];
  const productsQuery = useProductsQuery(
    { q: productSearch, limit: 10 },
    !!productSearch
  );
  const searchResults = productsQuery.data?.items ?? [];

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      type: 'SIMPLE',
      procurementType: 'INVENTORY',
      installationRequired: false,
      isDiscountable: true,
      bundleItems: [],
      ...initialData,
      basePriceCents: initialData?.basePriceCents
        ? (initialData.basePriceCents / 100).toFixed(2)
        : '',
      demoStock: initialData?.demoStock?.toString() ?? '0',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'bundleItems',
  });

  const productType = useWatch({ control, name: 'type' });
  const procurementType = useWatch({ control, name: 'procurementType' });
  const defaultSupplierId = useWatch({ control, name: 'defaultSupplierId' });
  const installationRequired = useWatch({ control, name: 'installationRequired' });
  const isDiscountable = useWatch({ control, name: 'isDiscountable' });

  const onSubmit = async (data: ProductFormData) => {
    try {
      const priceInCents = data.basePriceCents
        ? Math.round(Number(data.basePriceCents) * 100)
        : null;

      const payload = {
        ...data,
        basePriceCents: priceInCents,
        demoStock: data.demoStock ? Number(data.demoStock) : 0,
        defaultSupplierId: data.defaultSupplierId || null,
        bundleItems:
          data.type === 'BUNDLE'
            ? data.bundleItems?.map((i) => ({ childId: i.childId, quantity: i.quantity }))
            : undefined,
      };

      const response = await apiClient(
        initialData ? `/api/products/${initialData.id}` : '/api/products',
        {
          method: initialData ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        toast({ title: initialData ? 'Product updated' : 'Product created', variant: 'success' });
        onSuccess();
      } else {
        toast({ title: result.error?.message || 'Error saving product', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ title: 'Error saving product', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initialData ? 'ערוך מוצר' : 'הוסף מוצר חדש'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="name">שם מוצר *</Label>
              <Input id="name" {...register('name')} placeholder="שם המוצר" />
              {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" {...register('sku')} placeholder='מק"ט ייחודי' />
              {errors.sku && <p className="text-red-500 text-sm">{errors.sku.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">סוג מוצר</Label>
              <Select
                id="type"
                {...register('type')}
                onChange={(e) => setValue('type', e.target.value as any)}
                value={productType}
              >
                <option value="SIMPLE">רגיל</option>
                <option value="BUNDLE">באנדל (אריזה)</option>
                <option value="SERVICE">שירות</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="procurementType">סוג רכש</Label>
              <Select
                id="procurementType"
                {...register('procurementType')}
                onChange={(e) => setValue('procurementType', e.target.value as any)}
                value={procurementType}
              >
                <option value="INVENTORY">מלאי (Inventory)</option>
                <option value="DROPSHIP">דרופשיפ (Dropship)</option>
                <option value="SPECIAL_ORDER">הזמנה מיוחדת</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultSupplier">ספק ברירת מחדל</Label>
              <Select
                id="defaultSupplier"
                {...register('defaultSupplierId')}
                value={defaultSupplierId}
                onChange={(e) => setValue('defaultSupplierId', e.target.value)}
              >
                <option value="">ללא ספק</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">מחיר בסיס (₪)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register('basePriceCents')}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">מלאי דמו</Label>
              <Input id="stock" type="number" {...register('demoStock')} placeholder="0" />
            </div>

            <div className="space-y-2 col-span-2">
              <Label>קטגוריות</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-1 border p-2 rounded cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      id={`cat-${cat.id}`}
                      value={cat.id}
                      {...register('categoryIds')}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`cat-${cat.id}`} className="cursor-pointer text-sm">
                      {cat.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Switch
                className="ml-2"
                id="installationRequired"
                checked={installationRequired}
                onCheckedChange={(c) => setValue('installationRequired', c)}
              />
              <Label htmlFor="installationRequired">דורש התקנה</Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Switch
                className="ml-2"
                id="isDiscountable"
                checked={isDiscountable}
                onCheckedChange={(c) => setValue('isDiscountable', c)}
              />
              <Label htmlFor="isDiscountable">ניתן להנחה</Label>
            </div>
          </div>

          {/* Bundle Builder */}
          {productType === 'BUNDLE' && (
            <div className="border p-4 rounded-md mt-4 bg-gray-50">
              <h3 className="font-semibold mb-2">הרכב הבאנדל</h3>

              <div className="mb-4">
                <Label>הוסף מוצרים לבאנדל</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="חפש מוצר להוספה..."
                    className="pr-9"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {productSearch && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
                      {searchResults.map((p) => (
                        <div
                          key={p.id}
                          className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between"
                          onClick={() => {
                            append({ childId: p.id, childName: p.name, quantity: 1 });
                            setProductSearch('');
                          }}
                        >
                          <span>
                            {p.name} - {p.sku}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 p-2 bg-white rounded border"
                  >
                    <span className="flex-1 font-medium text-sm">{field.childName}</span>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      min={1}
                      {...register(`bundleItems.${index}.quantity`, { valueAsNumber: true })}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      הסר
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              ביטול
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {initialData ? 'עדכן מוצר' : 'צור מוצר'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
