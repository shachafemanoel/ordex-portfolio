'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Shield, ShieldAlert, Sparkles } from 'lucide-react';

interface AIRiskAssessmentResponse {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendations: string[];
  actions: string[];
  confidence: number;
  processingTime?: number;
}

interface AIRiskAssessmentWidgetProps {
  orderId: string;
  className?: string;
}

async function fetchRiskAssessment(orderId: string): Promise<AIRiskAssessmentResponse | null> {
  const res = await fetch(`/api/orders/${orderId}/ai/risk-assessment`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch risk assessment');
  const data = await res.json();
  return data.data; // Assuming createDataResponse wraps in { data: ... }
}

async function runRiskAssessment(orderId: string): Promise<AIRiskAssessmentResponse> {
  const res = await fetch(`/api/orders/${orderId}/ai/risk-assessment`, {
    method: 'POST',
    body: JSON.stringify({ context: { triggeredBy: 'widget' } }),
  });
  if (!res.ok) throw new Error('Failed to run risk assessment');
  const data = await res.json();
  return data.data;
}

export function AIRiskAssessmentWidget({ orderId, className }: AIRiskAssessmentWidgetProps) {
  const { t, direction } = useUITranslation();
  const queryClient = useQueryClient();
  const queryKey = ['ai', 'risk-assessment', orderId];

  const localizeRiskText = (text: string) => {
    const value = text?.trim();
    if (!value) return text;

    const normalized = value.toLowerCase();
    const rules: Array<{ key: string; patterns: string[] }> = [
      {
        key: 'orders.ai.risk.mockRecommendation.approveDev',
        patterns: ['approve automatically in dev', 'אשר אוטומטית בסביבת פיתוח'],
      },
      {
        key: 'orders.ai.risk.mockFactor.knownCustomer',
        patterns: ['known customer', 'לקוח מוכר'],
      },
      {
        key: 'orders.ai.risk.mockFactor.validAddress',
        patterns: ['valid address', 'כתובת תקינה'],
      },
      {
        key: 'orders.ai.risk.mockFactor.lowOrderValue',
        patterns: ['low order value', 'ערך הזמנה נמוך'],
      },
    ];

    for (const rule of rules) {
      if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
        return t(rule.key);
      }
    }

    return value;
  };

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchRiskAssessment(orderId),
  });

  const { mutate, isPending: isMutating } = useMutation({
    mutationFn: () => runRiskAssessment(orderId),
    onSuccess: (newData) => {
      queryClient.setQueryData(queryKey, newData);
    },
  });

  if (isLoading) {
    return (
      <Card className={cn('h-full min-h-[200px] flex items-center justify-center', className)}>
        <LoadingSpinner />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-red-100 bg-red-50', className)}>
        <CardContent className="pt-6 text-center text-red-600" dir={direction}>
          <ShieldAlert className="h-8 w-8 mx-auto mb-2" />
          <p>{t('orders.ai.risk.loadFailed')}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-2"
          >
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasData = !!data;

  // Render "Run Assessment" state if no data
  if (!hasData) {
    return (
      <Card className={cn('bg-slate-50 border-dashed', className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center" dir={direction}>
          <Shield className="h-10 w-10 text-slate-300 mb-3" />
          <h3 className="text-sm font-medium text-slate-900">{t('orders.ai.risk.title')}</h3>
          <p className="text-xs text-slate-500 mb-4 px-4">
            {t('orders.ai.risk.description')}
          </p>
          <Button
            onClick={() => mutate()}
            disabled={isMutating}
            className="bg-orange-600 hover:bg-orange-700 text-on-dark"
          >
            {isMutating ? (
              <LoadingSpinner className="mr-2 h-4 w-4" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {t('orders.ai.risk.analyze')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Render Assessment Data
  const riskColor =
    {
      LOW: 'bg-green-100 text-green-700 border-green-200',
      MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
      CRITICAL: 'bg-red-100 text-red-700 border-red-200',
    }[data.riskLevel] || 'bg-slate-100';

  const riskLevelLabel =
    {
      LOW: t('orders.ai.risk.level.low'),
      MEDIUM: t('orders.ai.risk.level.medium'),
      HIGH: t('orders.ai.risk.level.high'),
      CRITICAL: t('orders.ai.risk.level.critical'),
    }[data.riskLevel] || data.riskLevel;

  const riskIcon = {
    LOW: <CheckCircle className="h-5 w-5 text-green-600" />,
    MEDIUM: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
    HIGH: <AlertTriangle className="h-5 w-5 text-orange-600" />,
    CRITICAL: <ShieldAlert className="h-5 w-5 text-red-600" />,
  }[data.riskLevel];

  return (
    <Card className={cn('overflow-hidden', className)} dir={direction}>
      <CardHeader className="pb-3 border-b border-slate-50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4 text-orange-500" />
          {t('orders.ai.risk.title')}
        </CardTitle>
        <Badge className={cn('font-mono', riskColor)}>
          {riskLevelLabel} / {data.riskScore}
        </Badge>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{riskIcon}</div>
          <div className="space-y-1">
            <p className="text-sm text-slate-700 leading-snug">
              {data.recommendations?.[0]
                ? localizeRiskText(data.recommendations[0])
                : t('orders.ai.risk.noRecommendation')}
            </p>
            <p className="text-xs text-slate-400">
              {t('orders.ai.risk.confidence', undefined, {
                params: { percent: Math.round(data.confidence * 100) },
              })}
            </p>
          </div>
        </div>

        {data.factors?.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
              {t('orders.ai.risk.factors')}
            </h4>
            <ul className="space-y-1">
              {data.factors.map((factor, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-slate-400" />
                  {localizeRiskText(factor)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutate()}
            disabled={isMutating}
            className="text-xs text-slate-400 hover:text-orange-600"
          >
            {isMutating ? t('orders.ai.risk.refreshing') : t('orders.ai.risk.reanalyze')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
