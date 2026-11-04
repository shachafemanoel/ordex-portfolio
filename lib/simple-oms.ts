export function isSimpleOmsMode(): boolean {
  const value = process.env.SIMPLE_OMS_MODE ?? process.env.NEXT_PUBLIC_SIMPLE_OMS_MODE ?? 'false';
  return value === '1' || value.toLowerCase() === 'true';
}

export function isFeatureEnabled(feature: 'announcements' | 'aiInsights' | 'woocommerce'): boolean {
  if (isSimpleOmsMode()) {
    return false;
  }

  if (feature === 'aiInsights') {
    return process.env.ENABLE_AI_RISK_ASSESSMENT === 'true' || process.env.ENABLE_AI_FINANCIAL_ADVICE === 'true';
  }

  return true;
}
