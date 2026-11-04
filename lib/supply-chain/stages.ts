import { Calendar, CheckCircle, FileText, Hammer, LucideIcon, Package, Truck } from 'lucide-react';

export enum SupplyStage {
  INTAKE = 'INTAKE',
  PROCUREMENT = 'PROCUREMENT',
  RECEIVING = 'RECEIVING',
  SCHEDULING = 'SCHEDULING',
  EXECUTION = 'EXECUTION',
  CLOSURE = 'CLOSURE',

  // Backward-compatible aliases
  RECEIVED = 'INTAKE',
  PROCESSING = 'PROCUREMENT',
  READY = 'RECEIVING',
  IN_TRANSIT = 'SCHEDULING',
  INSTALLATION = 'EXECUTION',
  COMPLETED = 'CLOSURE',
}

export interface StageMetadata {
  id: SupplyStage;
  labelEn: string;
  labelHe: string;
  descriptionHe: string;
  icon: LucideIcon;
  color: string;
  order: number;
}

export const STAGE_METADATA: Record<SupplyStage, StageMetadata> = {
  [SupplyStage.INTAKE]: {
    id: SupplyStage.INTAKE,
    labelEn: 'Intake',
    labelHe: 'קליטה',
    descriptionHe: 'קליטת הזמנה ואימות ראשוני',
    icon: FileText,
    color: 'slate',
    order: 1,
  },
  [SupplyStage.PROCUREMENT]: {
    id: SupplyStage.PROCUREMENT,
    labelEn: 'Procurement',
    labelHe: 'רכש',
    descriptionHe: 'אישור ורכש מול ספקים',
    icon: Package,
    color: 'blue',
    order: 2,
  },
  [SupplyStage.RECEIVING]: {
    id: SupplyStage.RECEIVING,
    labelEn: 'Receiving',
    labelHe: 'קבלת סחורה',
    descriptionHe: 'קליטה חלקית/מלאה של פריטים',
    icon: Truck,
    color: 'indigo',
    order: 3,
  },
  [SupplyStage.SCHEDULING]: {
    id: SupplyStage.SCHEDULING,
    labelEn: 'Scheduling',
    labelHe: 'תיאום',
    descriptionHe: 'תיאום התקנה ומשלוח',
    icon: Calendar,
    color: 'amber',
    order: 4,
  },
  [SupplyStage.EXECUTION]: {
    id: SupplyStage.EXECUTION,
    labelEn: 'Execution',
    labelHe: 'ביצוע',
    descriptionHe: 'ביצוע התקנה/אספקה',
    icon: Hammer,
    color: 'orange',
    order: 5,
  },
  [SupplyStage.CLOSURE]: {
    id: SupplyStage.CLOSURE,
    labelEn: 'Closure',
    labelHe: 'סגירה',
    descriptionHe: 'הזמנה הושלמה ונסגרה',
    icon: CheckCircle,
    color: 'emerald',
    order: 6,
  },
};

export const ORDERED_STAGES: SupplyStage[] = [
  SupplyStage.INTAKE,
  SupplyStage.PROCUREMENT,
  SupplyStage.RECEIVING,
  SupplyStage.SCHEDULING,
  SupplyStage.EXECUTION,
  SupplyStage.CLOSURE,
];
