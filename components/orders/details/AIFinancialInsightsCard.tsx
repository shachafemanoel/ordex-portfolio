'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn, formatCurrency } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, DollarSign, Lightbulb, RefreshCw, TrendingUp } from 'lucide-react';
import { Cell, Pie, PieChart, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface AIFinancialInsightResponse {
  profitMargin: number;
  costAnalysis: Record<string, number>;
  pricingSuggestions: string[];
  upsellOpportunities: string[];
  confidence: number;
}

interface AIFinancialInsightsCardProps {
  orderId: string;
  className?: string;
}

async function fetchFinancialInsights(orderId: string): Promise<AIFinancialInsightResponse | null> {
  const res = await fetch(`/api/orders/${orderId}/ai/financial-insights`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch financial insights');
  const data = await res.json();
  return data.data;
}

async function runFinancialAnalysis(orderId: string): Promise<AIFinancialInsightResponse> {
  const res = await fetch(`/api/orders/${orderId}/ai/financial-insights`, {
    method: 'POST',
    body: JSON.stringify({ context: { triggeredBy: 'card' } }),
  });
  if (!res.ok) throw new Error('Failed to analyze financials');
  const data = await res.json();
  return data.data;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export function AIFinancialInsightsCard({ orderId, className }: AIFinancialInsightsCardProps) {
  const { t, direction } = useUITranslation();
  const queryClient = useQueryClient();
  const queryKey = ['ai', 'financial-insights', orderId];

  const localizeFinancialText = (text: string) => {
    const value = text?.trim();
    if (!value) return text;

    const normalized = value.toLowerCase();
    const rules: Array<{ key: string; patterns: string[] }> = [
      {
        key: 'orders.ai.financial.mockSuggestion.bulkDiscount',
        patterns: ['consider bulk discount', 'שקול הנחת כמות'],
      },
      {
        key: 'orders.ai.financial.mockSuggestion.bundleInstallation',
        patterns: ['bundle with installation', 'שלב עם שירות התקנה'],
      },
      {
        key: 'orders.ai.financial.mockUpsell.premiumSupport',
        patterns: ['premium support package', 'חבילת תמיכה פרימיום'],
      },
      {
        key: 'orders.ai.financial.mockUpsell.extendedWarranty',
        patterns: ['extended warranty', 'אחריות מורחבת'],
      },
    ];

    for (const rule of rules) {
      if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
        return t(rule.key);
      }
    }

    return value;
  };

  const localizeCostLabel = (label: string) => {
    const normalized = label.trim().toLowerCase();
    const mapping: Record<string, string> = {
      cogs: t('orders.ai.financial.costType.cogs'),
      shipping: t('orders.ai.financial.costType.shipping'),
      labor: t('orders.ai.financial.costType.labor'),
      tax: t('orders.ai.financial.costType.tax'),
      discount: t('orders.ai.financial.costType.discount'),
      other: t('orders.ai.financial.costType.other'),
    };
    return mapping[normalized] ?? label;
  };

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchFinancialInsights(orderId),
  });

  const { mutate, isPending: isMutating } = useMutation({
    mutationFn: () => runFinancialAnalysis(orderId),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
    },
  });

  if (isLoading) {
    return (
      <Card className={cn('bg-white h-[300px] flex items-center justify-center', className)}>
        <LoadingSpinner />
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className={cn('bg-slate-50 border-dashed relative', className)}>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center h-full" dir={direction}>
          <DollarSign className="h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-sm font-medium text-slate-900">{t('orders.ai.financial.title')}</h3>
          <p className="text-xs text-slate-500 mb-4 px-8">
            {t('orders.ai.financial.description')}
          </p>
          <Button
            onClick={() => mutate()}
            disabled={isMutating}
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            {isMutating ? (
              <LoadingSpinner className="mr-2 h-4 w-4" />
            ) : (
              <TrendingUp className="mr-2 h-4 w-4" />
            )}
            {t('orders.ai.financial.generate')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const costData = Object.entries(data.costAnalysis).map(([name, value]) => ({
    name: localizeCostLabel(name),
    value,
  }));

  return (
    <Card className={cn('overflow-hidden flex flex-col', className)} dir={direction}>
      <CardHeader className="pb-2 border-b border-slate-50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          {t('orders.ai.financial.intelligence')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'font-mono',
              data.profitMargin > 0.2
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-orange-50 text-orange-700 border-orange-200'
            )}
          >
            {t('orders.ai.financial.margin', undefined, {
              params: { percent: (data.profitMargin * 100).toFixed(1) },
            })}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => mutate()}
            disabled={isMutating}
          >
            <RefreshCw className={cn('h-3 w-3', isMutating && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Chart */}
        <div className="flex flex-col items-center justify-center min-h-[150px]">
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie
                data={costData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                fill="#8884d8"
                paddingAngle={5}
                dataKey="value"
              >
                {costData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number | undefined) => [
                  formatCurrency(value || 0),
                  t('orders.ai.financial.cost'),
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 text-center mt-2">{t('orders.ai.financial.costBreakdown')}</p>
        </div>

        {/* Right: Insights */}
        <div className="space-y-4">
          {data.upsellOpportunities.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" /> {t('orders.ai.financial.upsellOpportunities')}
              </h4>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                {data.upsellOpportunities.slice(0, 2).map((opp, i) => (
                  <li key={i}>{localizeFinancialText(opp)}</li>
                ))}
              </ul>
            </div>
          )}

          {data.pricingSuggestions.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> {t('orders.ai.financial.pricingStrategy')}
              </h4>
              <p className="text-xs text-slate-600 border-l-2 border-amber-200 pl-2">
                {localizeFinancialText(data.pricingSuggestions[0])}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
