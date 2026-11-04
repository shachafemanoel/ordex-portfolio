import { isAIFeatureEnabled } from '@/lib/featureFlags';
import { FinancialAnalysisEngine } from '@/src/server/domain/ai-integration/FinancialAnalysisEngine';
import { RiskAssessmentEngine } from '@/src/server/domain/ai-integration/RiskAssessmentEngine';
import { AIOmniSupplyClient } from '@/src/server/infrastructure/ai-omnisupply-client';

export class AIFeatureDisabledError extends Error {
  constructor(
    message: string,
    public readonly feature: 'RISK' | 'FINANCIAL'
  ) {
    super(message);
    this.name = 'AIFeatureDisabledError';
  }
}

export class AIIntegrationService {
  private riskEngine: RiskAssessmentEngine;
  private financialEngine: FinancialAnalysisEngine;

  constructor() {
    // Shared client instance (singleton-ish)
    const client = new AIOmniSupplyClient();
    this.riskEngine = new RiskAssessmentEngine(client);
    this.financialEngine = new FinancialAnalysisEngine(client);
  }

  async runRiskAssessment(orderId: string, context?: any) {
    if (!isAIFeatureEnabled('RISK')) {
      throw new AIFeatureDisabledError('AI Risk Assessment feature is disabled', 'RISK');
    }
    return this.riskEngine.assessOrder(orderId, context);
  }

  async runFinancialAnalysis(orderId: string, context?: any) {
    if (!isAIFeatureEnabled('FINANCIAL')) {
      throw new AIFeatureDisabledError('AI Financial Advice feature is disabled', 'FINANCIAL');
    }
    return this.financialEngine.analyzeOrder(orderId, context);
  }

  async getLatestRiskAssessment(orderId: string) {
    if (!isAIFeatureEnabled('RISK')) return null;
    return this.riskEngine.getLatestAssessment(orderId);
  }

  async getLatestFinancialInsight(orderId: string) {
    if (!isAIFeatureEnabled('FINANCIAL')) return null;
    return this.financialEngine.getLatestInsight(orderId);
  }
}
