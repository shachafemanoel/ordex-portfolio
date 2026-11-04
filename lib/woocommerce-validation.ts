// WooCommerce Order Validation Utilities
// Validates orders and identifies missing required information

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  category: 'customer' | 'order' | 'address' | 'items';
}

export interface ValidationResult {
  isValid: boolean;
  canSaveToSystem: boolean;
  issues: ValidationIssue[];
  missingRequiredFields: string[];
  warnings: string[];
}

export interface WooCommerceOrderForValidation {
  id: number;
  number: string;
  status: string;
  customer_id: number;
  date_created: string;
  total: string;
  currency: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address_1: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    quantity: number;
    subtotal: string;
    total: string;
    sku: string;
  }>;
  payment_method: string;
  payment_method_title: string;
}

/**
 * Validates a WooCommerce order for system compatibility
 */
export function validateWooCommerceOrder(order: WooCommerceOrderForValidation): ValidationResult {
  const issues: ValidationIssue[] = [];
  const missingRequiredFields: string[] = [];
  const warnings: string[] = [];

  // Required fields for basic order creation
  const requiredFields = [
    { field: 'number', value: order.number, category: 'order' as const },
    { field: 'total', value: order.total, category: 'order' as const },
    { field: 'currency', value: order.currency, category: 'order' as const },
  ];

  // Check required fields
  requiredFields.forEach(({ field, value, category }) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingRequiredFields.push(field);
      issues.push({
        field,
        message: `שדה חובה חסר: ${getFieldDisplayName(field)}`,
        severity: 'error',
        category,
      });
    }
  });

  // Customer information validation
  const customer = order.billing;
  if (!customer) {
    issues.push({
      field: 'billing',
      message: 'פרטי הלקוח חסרים לחלוטין',
      severity: 'error',
      category: 'customer',
    });
    missingRequiredFields.push('customer_info');
  } else {
    // Customer name validation
    if (!customer.first_name && !customer.last_name) {
      issues.push({
        field: 'customer_name',
        message: 'שם הלקוח חסר (שם פרטי או משפחה)',
        severity: 'error',
        category: 'customer',
      });
      missingRequiredFields.push('customer_name');
    }

    // Contact information validation
    if (!customer.email && !customer.phone) {
      issues.push({
        field: 'customer_contact',
        message: 'פרטי התקשרות חסרים (אימייל או טלפון)',
        severity: 'error',
        category: 'customer',
      });
      missingRequiredFields.push('customer_contact');
    }

    // Email validation
    if (customer.email && !isValidEmail(customer.email)) {
      issues.push({
        field: 'email',
        message: 'כתובת אימייל לא תקינה',
        severity: 'warning',
        category: 'customer',
      });
      warnings.push('invalid_email');
    }

    // Phone validation
    if (customer.phone && !isValidIsraeliPhone(customer.phone)) {
      issues.push({
        field: 'phone',
        message: 'מספר טלפון לא תקין או לא בפורמט ישראלי',
        severity: 'warning',
        category: 'customer',
      });
      warnings.push('invalid_phone');
    }

    // Address validation
    if (!customer.address_1 || !customer.city) {
      const missingAddressParts = [];
      if (!customer.address_1) missingAddressParts.push('כתובת');
      if (!customer.city) missingAddressParts.push('עיר');

      issues.push({
        field: 'address',
        message: `כתובת לא שלמה: חסר ${missingAddressParts.join(', ')}`,
        severity: 'warning',
        category: 'address',
      });
      warnings.push('incomplete_address');
    }
  }

  // Line items validation
  if (!order.line_items || order.line_items.length === 0) {
    issues.push({
      field: 'line_items',
      message: 'ההזמנה לא מכילה פריטים',
      severity: 'error',
      category: 'items',
    });
    missingRequiredFields.push('line_items');
  } else {
    // Check each line item
    order.line_items.forEach((item, index) => {
      if (!item.name || item.name.trim() === '') {
        issues.push({
          field: `line_item_${index}_name`,
          message: `פריט ${index + 1}: שם המוצר חסר`,
          severity: 'warning',
          category: 'items',
        });
        warnings.push(`missing_item_name_${index}`);
      }

      if (!item.sku || item.sku.trim() === '') {
        issues.push({
          field: `line_item_${index}_sku`,
          message: `פריט ${index + 1}: קוד מוצר (SKU) חסר`,
          severity: 'warning',
          category: 'items',
        });
        warnings.push(`missing_item_sku_${index}`);
      }

      if (item.quantity <= 0) {
        issues.push({
          field: `line_item_${index}_quantity`,
          message: `פריט ${index + 1}: כמות לא תקינה`,
          severity: 'warning',
          category: 'items',
        });
        warnings.push(`invalid_quantity_${index}`);
      }
    });
  }

  // Payment method validation
  if (!order.payment_method) {
    issues.push({
      field: 'payment_method',
      message: 'אמצעי התשלום לא צוין',
      severity: 'info',
      category: 'order',
    });
    warnings.push('missing_payment_method');
  }

  // Determine if order can be saved to system
  const canSaveToSystem = missingRequiredFields.length === 0;
  const isValid = issues.filter(issue => issue.severity === 'error').length === 0;

  return {
    isValid,
    canSaveToSystem,
    issues,
    missingRequiredFields,
    warnings,
  };
}

/**
 * Validates multiple WooCommerce orders and groups them by status
 */
export function validateOrdersBatch(orders: WooCommerceOrderForValidation[]) {
  const results = {
    valid: [] as Array<{ order: WooCommerceOrderForValidation; validation: ValidationResult }>,
    hasWarnings: [] as Array<{ order: WooCommerceOrderForValidation; validation: ValidationResult }>,
    invalid: [] as Array<{ order: WooCommerceOrderForValidation; validation: ValidationResult }>,
    totalIssues: 0,
    summary: {
      totalOrders: orders.length,
      validOrders: 0,
      ordersWithWarnings: 0,
      invalidOrders: 0,
      canSaveCount: 0,
    }
  };

  orders.forEach(order => {
    const validation = validateWooCommerceOrder(order);
    results.totalIssues += validation.issues.length;

    const orderResult = { order, validation };

    if (validation.isValid && validation.issues.length === 0) {
      results.valid.push(orderResult);
      results.summary.validOrders++;
    } else if (validation.canSaveToSystem) {
      results.hasWarnings.push(orderResult);
      results.summary.ordersWithWarnings++;
    } else {
      results.invalid.push(orderResult);
      results.summary.invalidOrders++;
    }

    if (validation.canSaveToSystem) {
      results.summary.canSaveCount++;
    }
  });

  return results;
}

/**
 * Gets user-friendly display name for field
 */
function getFieldDisplayName(field: string): string {
  const fieldNames: Record<string, string> = {
    number: 'מספר הזמנה',
    total: 'סכום',
    currency: 'מטבע',
    customer_name: 'שם לקוח',
    customer_contact: 'פרטי התקשרות',
    email: 'אימייל',
    phone: 'טלפון',
    address: 'כתובת',
    line_items: 'פריטים',
    payment_method: 'אמצעי תשלום',
  };

  return fieldNames[field] || field;
}

/**
 * Validates email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates Israeli phone number format
 */
function isValidIsraeliPhone(phone: string): boolean {
  // Clean the phone number
  const cleaned = phone.replace(/[^\d]/g, '');

  // Israeli mobile: 05X-XXX-XXXX (10 digits starting with 05)
  // Israeli landline: 0X-XXX-XXXX (9 digits starting with 02, 03, 04, 08, 09)
  const mobileRegex = /^05[0-9]{8}$/;
  const landlineRegex = /^0[2-4,8-9][0-9]{7}$/;

  return mobileRegex.test(cleaned) || landlineRegex.test(cleaned);
}

/**
 * Gets validation summary text
 */
export function getValidationSummaryText(validation: ValidationResult): string {
  if (validation.isValid && validation.issues.length === 0) {
    return 'ההזמנה תקינה ומוכנה לשמירה';
  }

  if (validation.canSaveToSystem) {
    return `ההזמנה מוכנה לשמירה עם ${validation.warnings.length} אזהרות`;
  }

  return `ההזמנה לא מוכנה לשמירה - ${validation.missingRequiredFields.length} שדות חובה חסרים`;
}

/**
 * Gets validation status color for UI
 */
export function getValidationStatusColor(validation: ValidationResult): string {
  if (validation.isValid && validation.issues.length === 0) {
    return 'text-green-600 bg-green-50';
  }

  if (validation.canSaveToSystem) {
    return 'text-yellow-600 bg-yellow-50';
  }

  return 'text-red-600 bg-red-50';
}