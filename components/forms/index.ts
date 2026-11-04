/**
 * Form Components - Centralized Export
 *
 * Single source of truth for all form components.
 * All forms include complete Prisma schema field coverage.
 *
 * @example
 * ```tsx
 * import { CustomerForm, AddressForm, ItemEditor, PaymentForm } from '@/components/forms';
 * ```
 */

// ============================================================================
// CUSTOMER FORMS
// ============================================================================

export { CustomerForm } from '@/components/customers/CustomerForm';
export type { CustomerFormData, CustomerFormProps } from '@/components/customers/CustomerForm';

export { AddressForm } from '@/components/customers/AddressForm';
export type { AddressFormData, AddressFormProps } from '@/components/customers/AddressForm';

// ============================================================================
// ORDER FORMS
// ============================================================================

export { ItemEditor } from '@/components/orders/ops/ItemEditor';
export type { ItemEditorProps, OrderItem } from '@/components/orders/ops/ItemEditor';

export { PaymentForm } from '@/components/orders/forms/PaymentForm';
export type { PaymentFormData, PaymentFormProps } from '@/components/orders/forms/PaymentForm';

// ============================================================================
// FORM FIELD COMPONENTS (from UI)
// ============================================================================

export { Checkbox } from '@/components/ui/Checkbox';
export { FormField } from '@/components/ui/FormField';
export { Input } from '@/components/ui/Input';
export { Select } from '@/components/ui/Select';
export { Textarea } from '@/components/ui/Textarea';
// export { RadioGroup } from '@/components/ui/RadioGroup';
export { Label } from '@/components/ui/Label';

// ============================================================================
// USAGE GUIDELINES
// ============================================================================
//
// **Form Components with Full Prisma Coverage:**
//
// 1. **CustomerForm** - Customer creation/editing
//    - ✅ All fields: name, email, phone
//    - ✅ Financial: creditLimitCents, paymentTermsDays
//    - ✅ Account: accountNotes
//
// 2. **AddressForm** - Address creation/editing
//    - ✅ All fields: type, city, street, number, floor, notes
//    - ✅ Geocoding: lat, lng (automatic)
//
// 3. **ItemEditor** - Order items management
//    - ✅ All fields: skuId, sku, name, qty, priceCents
//    - ✅ Tax: taxRate, vatCategory
//    - ✅ Optional: description, supplierId
//    - ✅ Auto-calculation: totalCents
//
// 4. **PaymentForm** - Payment recording
//    - ✅ All fields: method, status, amountCents
//    - ✅ Optional: reference, notes, externalId
//    - ✅ Auto-calculation: balance
//
// **Missing Forms (TODO):**
// - SupplierForm (use existing in components/suppliers/)
// - ProductForm
// - PurchaseOrderForm
//
// **Forms That Need Updates:**
// - OrderCreateForm - missing 8 fields (priority, scheduledAt, installerName, etc.)
// - OrderCreateFormV2 - consolidate with OrderCreateForm
//
