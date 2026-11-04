import React from 'react';
import { Warehouse, ShoppingCart, Package, Truck } from 'lucide-react';
import { WorkflowTab } from './types';

export const WORKFLOW_TABS: { key: WorkflowTab; label: string; icon: React.ReactNode }[] = [
  { key: 'intake', label: 'בדיקת מלאי', icon: <Warehouse className="h-4 w-4" /> },
  { key: 'purchase', label: 'הזמנת רכש', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'receive', label: 'קליטת מלאי', icon: <Package className="h-4 w-4" /> },
  { key: 'schedule', label: 'תיאום משלוח', icon: <Truck className="h-4 w-4" /> },
  { key: 'delivery', label: 'ביצוע משלוח', icon: <Truck className="h-4 w-4" /> },
];

export const STAGE_COPY: Record<WorkflowTab, { title: string; description: string }> = {
  actions: { title: 'פעולות', description: 'פעולות זמינות להזמנה.' },
  intake: {
    title: 'שלב 1: בדיקת מלאי',
    description: 'הגדר לכל פריט האם זמין מהמחסן או דורש רכש.',
  },
  purchase: {
    title: 'שלב 2: הזמנת רכש',
    description: 'בחר פריטים, שייך ספקים וקבע צפי קבלת מלאי.',
  },
  receive: {
    title: 'שלב 3: קליטת מלאי',
    description: 'אשר אילו פריטים הגיעו ומוכנים לאספקה ללקוח.',
  },
  schedule: {
    title: 'שלב 4: תיאום משלוח',
    description: 'בחר מועד אספקה, הוסף הערות שליח וסנכרן למסך משלוחים.',
  },
  delivery: {
    title: 'שלב 5: ביצוע משלוח',
    description: 'פתח ניווט, אשר checklist שטח, וסיים את ההזמנה מתוך המסלול המבצעי.',
  },
};
