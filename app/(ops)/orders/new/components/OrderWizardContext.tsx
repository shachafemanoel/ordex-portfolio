'use client';

import { PaymentStatus } from '@prisma/client';
import React, { ReactNode, createContext, useCallback, useContext, useReducer, useRef } from 'react';

// ============================================
// Types
// ============================================

export type WizardStep = 'customer' | 'products' | 'summary';

export interface CustomerAddress {
  id: string;
  type: 'BILLING' | 'SHIPPING';
  city: string;
  street: string;
  number: string;
  floor?: string | null;
  apartment?: string | null;
  notes?: string | null;
}

export interface SelectedCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  addresses: CustomerAddress[];
}

export interface OrderItemDraft {
  id: string; // Temporary ID for UI tracking
  productId?: string;
  productName: string;
  productSku: string;
  productImageUrl?: string | null;
  supplierId?: string;
  supplierName?: string;
  quantity: number;
  priceCents: number; // Price per unit in cents
  remarks?: string;
  inventoryEnabled?: boolean;
  procurementRequired?: boolean;
  serialNumberType?: 'NONE' | 'AUTO' | 'MANUAL';
  wasOnSale?: boolean;
  originalPriceCents?: number | null;
}

export interface PaymentInfo {
  method: string;
  amountCents: number;
  status: PaymentStatus;
}

export interface DeliverySchedule {
  date: Date | null;
  slot: string | null; // e.g., 'morning', 'afternoon'
  installerId: string | null;
  notes: string;
}

export interface OrderWizardState {
  step: WizardStep;
  customer: SelectedCustomer | null;
  billingAddressId: string | null;
  shippingAddressId: string | null;
  items: OrderItemDraft[];
  schedule: DeliverySchedule;
  payment: PaymentInfo | null;
  notes: string;
  isSubmitting: boolean;
  error: string | null;
}

// ============================================
// Actions
// ============================================

type OrderWizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SET_CUSTOMER'; customer: SelectedCustomer | null }
  | { type: 'SET_BILLING_ADDRESS'; addressId: string | null }
  | { type: 'SET_SHIPPING_ADDRESS'; addressId: string | null }
  | { type: 'ADD_ITEM'; item: OrderItemDraft }
  | { type: 'UPDATE_ITEM'; id: string; updates: Partial<OrderItemDraft> }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'SET_ITEMS'; items: OrderItemDraft[] }
  | { type: 'SET_SCHEDULE'; schedule: Partial<DeliverySchedule> }
  | { type: 'SET_PAYMENT'; payment: PaymentInfo | null }
  | { type: 'SET_NOTES'; notes: string }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET' };

// ============================================
// Initial State
// ============================================

const initialState: OrderWizardState = {
  step: 'customer',
  customer: null,
  billingAddressId: null,
  shippingAddressId: null,
  items: [],
  schedule: {
    date: null,
    slot: null,
    installerId: null,
    notes: '',
  },
  payment: null,
  notes: '',
  isSubmitting: false,
  error: null,
};

// ============================================
// Reducer
// ============================================

function orderWizardReducer(state: OrderWizardState, action: OrderWizardAction): OrderWizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_CUSTOMER':
      // When customer changes, reset addresses
      return {
        ...state,
        customer: action.customer,
        billingAddressId: action.customer?.addresses?.find((a) => a.type === 'BILLING')?.id ?? null,
        shippingAddressId:
          action.customer?.addresses?.find((a) => a.type === 'SHIPPING')?.id ??
          action.customer?.addresses?.find((a) => a.type === 'BILLING')?.id ??
          null,
        error: null,
      };

    case 'SET_BILLING_ADDRESS':
      return { ...state, billingAddressId: action.addressId };

    case 'SET_SHIPPING_ADDRESS':
      return { ...state, shippingAddressId: action.addressId };

    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.item] };

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, ...action.updates } : item
        ),
      };

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
      };

    case 'SET_ITEMS':
      return { ...state, items: action.items };

    case 'SET_SCHEDULE':
      return { ...state, schedule: { ...state.schedule, ...action.schedule } };

    case 'SET_PAYMENT':
      return { ...state, payment: action.payment };

    case 'SET_NOTES':
      return { ...state, notes: action.notes };

    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.isSubmitting };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface OrderWizardContextValue {
  state: OrderWizardState;
  dispatch: React.Dispatch<OrderWizardAction>;

  /** Wall-clock ms at provider mount (wizard session start), for optional create-order telemetry. */
  wizardSessionStartedAtMs: number;

  // Computed values
  totalCents: number;
  canProceedToProducts: boolean;
  canProceedToSummary: boolean;
  canSubmit: boolean;

  // Navigation helpers
  goToStep: (step: WizardStep) => void;
  goNext: () => void;
  goBack: () => void;

  // Data helpers
  setCustomer: (customer: SelectedCustomer | null) => void;
  addItem: (item: Omit<OrderItemDraft, 'id'>) => void;
  updateItem: (id: string, updates: Partial<OrderItemDraft>) => void;
  removeItem: (id: string) => void;
  setSchedule: (schedule: Partial<DeliverySchedule>) => void;
  setPayment: (payment: PaymentInfo | null) => void;
  setNotes: (notes: string) => void;
  reset: () => void;
}

const OrderWizardContext = createContext<OrderWizardContextValue | null>(null);

// ============================================
// Provider
// ============================================

interface OrderWizardProviderProps {
  children: ReactNode;
  initialState?: Partial<OrderWizardState>;
}

export function OrderWizardProvider({
  children,
  initialState: initialPropsState,
}: OrderWizardProviderProps) {
  const wizardSessionStartedAtMsRef = useRef<number>(Date.now());

  const [state, dispatch] = useReducer(orderWizardReducer, {
    ...initialState,
    ...initialPropsState,
  });

  // Computed values
  const totalCents = state.items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);

  const canProceedToProducts = !!(
    state.customer &&
    state.billingAddressId &&
    state.shippingAddressId
  );

  const canProceedToSummary = canProceedToProducts && state.items.length > 0;

  const canSubmit = canProceedToSummary && !state.isSubmitting && !!state.payment;

  // Navigation helpers

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const goNext = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.step);
    if (currentIndex < STEP_ORDER.length - 1) {
      dispatch({ type: 'SET_STEP', step: STEP_ORDER[currentIndex + 1] });
    }
  }, [state.step]);

  const goBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.step);
    if (currentIndex > 0) {
      dispatch({ type: 'SET_STEP', step: STEP_ORDER[currentIndex - 1] });
    }
  }, [state.step]);

  // Data helpers
  const setCustomer = useCallback((customer: SelectedCustomer | null) => {
    dispatch({ type: 'SET_CUSTOMER', customer });
  }, []);

  const addItem = useCallback((item: Omit<OrderItemDraft, 'id'>) => {
    const newItem: OrderItemDraft = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    dispatch({ type: 'ADD_ITEM', item: newItem });
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<OrderItemDraft>) => {
    dispatch({ type: 'UPDATE_ITEM', id, updates });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', id });
  }, []);

  const setSchedule = useCallback((schedule: Partial<DeliverySchedule>) => {
    dispatch({ type: 'SET_SCHEDULE', schedule });
  }, []);

  const setPayment = useCallback((payment: PaymentInfo | null) => {
    dispatch({ type: 'SET_PAYMENT', payment });
  }, []);

  const setNotes = useCallback((notes: string) => {
    dispatch({ type: 'SET_NOTES', notes });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value: OrderWizardContextValue = {
    state,
    dispatch,
    wizardSessionStartedAtMs: wizardSessionStartedAtMsRef.current,
    totalCents,
    canProceedToProducts,
    canProceedToSummary,
    canSubmit,
    goToStep,
    goNext,
    goBack,
    setCustomer,
    addItem,
    updateItem,
    removeItem,
    setSchedule,
    setPayment,
    setNotes,
    reset,
  };

  return <OrderWizardContext.Provider value={value}>{children}</OrderWizardContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useOrderWizard(): OrderWizardContextValue {
  const context = useContext(OrderWizardContext);
  if (!context) {
    throw new Error('useOrderWizard must be used within an OrderWizardProvider');
  }
  return context;
}

// ============================================
// Step Labels
// ============================================

export const STEP_LABEL_KEYS: Record<WizardStep, string> = {
  customer: 'orders.new.step.customer',
  products: 'orders.new.step.products',
  summary: 'orders.new.step.summary',
};

export const STEP_ORDER: WizardStep[] = ['customer', 'products', 'summary'];
