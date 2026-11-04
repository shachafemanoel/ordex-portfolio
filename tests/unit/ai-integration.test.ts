import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isAIFeatureEnabled } from '../../lib/featureFlags';
import { FinancialAnalysisEngine } from '../../src/server/domain/ai-integration/FinancialAnalysisEngine';
import { RiskAssessmentEngine } from '../../src/server/domain/ai-integration/RiskAssessmentEngine';
import { AIIntegrationService } from '../../src/server/services/AIIntegrationService';

// Mock dependencies
vi.mock('../../src/server/domain/ai-integration/RiskAssessmentEngine');
vi.mock('../../src/server/domain/ai-integration/FinancialAnalysisEngine');
vi.mock('../../lib/featureFlags', () => ({
  isAIFeatureEnabled: vi.fn().mockReturnValue(true),
}));

describe('AIIntegrationService', () => {
  let service: AIIntegrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIIntegrationService();
  });

  it('should instantiate correctly', () => {
    expect(service).toBeDefined();
    expect(RiskAssessmentEngine).toHaveBeenCalled();
    expect(FinancialAnalysisEngine).toHaveBeenCalled();
  });

  it('should call risk engine when executing risk assessment', async () => {
    const mockRiskEngine = vi.mocked(RiskAssessmentEngine).mock.instances[0];
    const mockAssessOrder = vi
      .fn()
      .mockResolvedValue({ riskScore: 50, riskLevel: 'MEDIUM' } as any);
    mockRiskEngine.assessOrder = mockAssessOrder;

    await service.runRiskAssessment('order-123');

    expect(isAIFeatureEnabled).toHaveBeenCalledWith('RISK');
    expect(mockAssessOrder).toHaveBeenCalledWith('order-123', undefined);
  });

  it('should call financial engine when executing financial analysis', async () => {
    const mockFinancialEngine = vi.mocked(FinancialAnalysisEngine).mock.instances[0];
    const mockAnalyzeOrder = vi.fn().mockResolvedValue({ profitMargin: 0.2 } as any);
    mockFinancialEngine.analyzeOrder = mockAnalyzeOrder;

    await service.runFinancialAnalysis('order-123');

    expect(isAIFeatureEnabled).toHaveBeenCalledWith('FINANCIAL');
    expect(mockAnalyzeOrder).toHaveBeenCalledWith('order-123', undefined);
  });
});
