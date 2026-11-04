import { OrderTaskColor } from '@/src/server/dto/ops.dto';

export type OpsTone = 'critical' | 'warning' | 'active' | 'delivery' | 'success' | 'neutral';

const OPS_TONE_CLASS_MAP: Record<
  OpsTone,
  {
    badge: string;
    panel: string;
    softPanel: string;
    border: string;
    accentBar: string;
    progress: string;
    text: string;
    iconWrap: string;
    button: string;
    outlineButton: string;
  }
> = {
  critical: {
    badge: 'border-red-200 bg-red-50 text-red-700',
    panel: 'border-red-200 bg-red-50/70 text-red-900',
    softPanel: 'bg-red-50 text-red-800',
    border: 'border-red-200',
    accentBar: 'bg-red-500',
    progress: 'text-red-500',
    text: 'text-red-700',
    iconWrap: 'bg-red-100 text-red-600',
    button: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/20',
    outlineButton: 'border-red-200 bg-white text-red-700 hover:bg-red-50',
  },
  warning: {
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    panel: 'border-amber-200 bg-amber-50/70 text-amber-950',
    softPanel: 'bg-amber-50 text-amber-800',
    border: 'border-amber-200',
    accentBar: 'bg-amber-500',
    progress: 'text-amber-500',
    text: 'text-amber-700',
    iconWrap: 'bg-amber-100 text-amber-700',
    button: 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20',
    outlineButton: 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50',
  },
  active: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    panel: 'border-blue-200 bg-blue-50/70 text-blue-950',
    softPanel: 'bg-blue-50 text-blue-800',
    border: 'border-blue-200',
    accentBar: 'bg-blue-500',
    progress: 'text-blue-500',
    text: 'text-blue-700',
    iconWrap: 'bg-blue-100 text-blue-600',
    button: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20',
    outlineButton: 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50',
  },
  delivery: {
    badge: 'border-teal-200 bg-teal-50 text-teal-700',
    panel: 'border-teal-200 bg-teal-50/70 text-teal-950',
    softPanel: 'bg-teal-50 text-teal-800',
    border: 'border-teal-200',
    accentBar: 'bg-teal-500',
    progress: 'text-teal-500',
    text: 'text-teal-700',
    iconWrap: 'bg-teal-100 text-teal-600',
    button: 'bg-teal-600 text-white hover:bg-teal-700 shadow-lg shadow-teal-500/20',
    outlineButton: 'border-teal-200 bg-white text-teal-700 hover:bg-teal-50',
  },
  success: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    panel: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
    softPanel: 'bg-emerald-50 text-emerald-800',
    border: 'border-emerald-200',
    accentBar: 'bg-emerald-500',
    progress: 'text-emerald-500',
    text: 'text-emerald-700',
    iconWrap: 'bg-emerald-100 text-emerald-600',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20',
    outlineButton: 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
  },
  neutral: {
    badge: 'border-slate-200 bg-slate-50 text-slate-700',
    panel: 'border-slate-200 bg-slate-50/90 text-slate-900',
    softPanel: 'bg-slate-50 text-slate-700',
    border: 'border-slate-200',
    accentBar: 'bg-slate-300',
    progress: 'text-slate-400',
    text: 'text-slate-600',
    iconWrap: 'bg-slate-100 text-slate-500',
    button: 'bg-slate-700 text-white hover:bg-slate-800 shadow-lg shadow-slate-500/10',
    outlineButton: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  },
};

export function getOpsToneClasses(tone: OpsTone) {
  return OPS_TONE_CLASS_MAP[tone];
}

export function mapTaskColorToTone(color: OrderTaskColor): OpsTone {
  switch (color) {
    case 'ORANGE':
      return 'warning';
    case 'BLUE':
      return 'active';
    case 'GRAY':
    default:
      return 'neutral';
  }
}

/**
 * Get Tailwind CSS classes for a derived task color
 */
export function getTaskColorClasses(color: OrderTaskColor): string {
  return getOpsToneClasses(mapTaskColorToTone(color)).badge;
}

export function getTaskProgressClass(color: OrderTaskColor): string {
  return getOpsToneClasses(mapTaskColorToTone(color)).accentBar;
}

export function getTaskPanelClass(color: OrderTaskColor): string {
  return getOpsToneClasses(mapTaskColorToTone(color)).panel;
}

/**
 * Maps TaskColor to semantic semantic color tokens
 */
export function getSemanticColor(color: OrderTaskColor) {
  switch (mapTaskColorToTone(color)) {
    case 'warning':
      return 'amber';
    case 'active':
      return 'blue';
    default:
      return 'slate';
  }
}
