'use client';

import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CircleDollarSign, Link2Off, PackageCheck } from 'lucide-react';
import { ProductIssue } from '@/components/products/workspace/types';

interface KpiItem {
  issue: ProductIssue | 'ACTIVE_PRODUCTS';
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

interface ProductsKpiStripProps {
  kpis: KpiItem[];
  activeIssue: ProductIssue | null;
  onIssueSelect: (issue: ProductIssue | null) => void;
}

const ISSUE_STYLES: Record<ProductIssue | 'ACTIVE_PRODUCTS', string> = {
  ACTIVE_PRODUCTS: 'text-emerald-600',
  LOW_STOCK: 'text-amber-600',
  MISSING_PRICE: 'text-blue-600',
  NOT_SYNCED: 'text-red-600',
  MISSING_IMAGE: 'text-slate-600',
  MISSING_SKU: 'text-slate-600',
};

export const PRODUCTS_KPI_ICONS = {
  ACTIVE_PRODUCTS: PackageCheck,
  LOW_STOCK: AlertTriangle,
  MISSING_PRICE: CircleDollarSign,
  NOT_SYNCED: Link2Off,
};

export function ProductsKpiStrip({ kpis, activeIssue, onIssueSelect }: ProductsKpiStripProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const isActive = kpi.issue !== 'ACTIVE_PRODUCTS' && activeIssue === kpi.issue;

        return (
          <button
            key={kpi.issue}
            type="button"
            onClick={() =>
              onIssueSelect(
                kpi.issue === 'ACTIVE_PRODUCTS'
                  ? null
                  : activeIssue === kpi.issue
                  ? null
                  : kpi.issue
              )
            }
            className="text-right"
            aria-pressed={isActive}
          >
            <Card
              className={`border transition-all ${
                isActive ? 'border-primary-400 ring-2 ring-primary-100' : 'border-slate-200'
              }`}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-slate-900">{kpi.value}</p>
                </div>
                <Icon className={`h-5 w-5 ${ISSUE_STYLES[kpi.issue]}`} />
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
