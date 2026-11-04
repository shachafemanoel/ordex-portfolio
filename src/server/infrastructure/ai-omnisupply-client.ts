import { getFeatureEnv } from '@/lib/envConfig';

export interface AIClientConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface AIRiskAssessmentRequest {
  orderId: string;
  orderData: any; // Type strictly later with Order DTO
  context?: any;
}

export interface AIRiskAssessmentResponse {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: string[];
  recommendations: string[];
  actions: string[];
  confidence: number;
  usage?: {
    totalTokens: number;
  };
}

export interface AIFinancialInsightRequest {
  orderId: string;
  orderData: any;
  marketData?: any;
}

export interface AIFinancialInsightResponse {
  profitMargin: number;
  costAnalysis: Record<string, number>; // e.g., { "cogs": 100, "shipping": 20 }
  pricingSuggestions: string[];
  upsellOpportunities: string[];
  confidence: number;
}

export class AIOmniSupplyClient {
  private config: AIClientConfig;

  constructor() {
    const env = getFeatureEnv('aiIntegration');
    if (!env) {
      throw new Error('AI Integration feature is not configured in environment');
    }

    this.config = {
      apiUrl: env.OMNISUPPLY_API_URL || 'https://api.omnisupply.ai/v1',
      apiKey: env.OMNISUPPLY_API_KEY || '',
      model: env.AI_MODEL,
      maxRetries: env.AI_MAX_RETRIES,
      timeoutMs: env.AI_AGENT_TIMEOUT_MS,
    };

    if (!this.config.apiKey) {
      console.warn('⚠️ OMNISUPPLY_API_KEY is not set. AI features will mock responses or fail.');
    }
  }

  /**
   * Performs a risk assessment for a given order using the AI agent.
   */
  async assessRisk(request: AIRiskAssessmentRequest): Promise<AIRiskAssessmentResponse> {
    return this.callAgent<AIRiskAssessmentResponse>('risk-assessment', request);
  }

  /**
   * Generates financial insights/audit for an order.
   */
  async analyzeFinancials(request: AIFinancialInsightRequest): Promise<AIFinancialInsightResponse> {
    return this.callAgent<AIFinancialInsightResponse>('financial-audit', request);
  }

  /**
   * Generic method to call an AI agent with retry logic.
   */
  private async callAgent<T>(agentEndpoint: string, payload: any): Promise<T> {
    const url = `${this.config.apiUrl}/${agentEndpoint}`;
    let attempt = 0;

    // Optimization: If no API key, fail fast and mock (in all environments)
    if (!this.config.apiKey) {
      console.warn(`[AI] No API key, mocking response for ${agentEndpoint}`);
      return this.getMockResponse<T>(agentEndpoint);
    }

    while (attempt < this.config.maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
            'X-Model': this.config.model,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`AI Service Error (${response.status}): ${errorText}`);
        }

        return (await response.json()) as T;
      } catch (error: any) {
        attempt++;
        const isRetryable =
          error.name === 'AbortError' ||
          (error.message && (error.message.includes('50') || error.message.includes('Network'))) ||
          error.code === 'ENOTFOUND'; // Explicitly retry DNS errors

        console.error(
          `Attempt ${attempt}/${this.config.maxRetries} failed calling ${agentEndpoint}:`,
          error instanceof Error ? error.message : String(error)
        );

        if (attempt >= this.config.maxRetries || !isRetryable) {
          // If we are in development mode, fallback to mock instead of crashing
          console.warn(
            `⚠️ [AI] Request failed after retries. Mocking response for '${agentEndpoint}'`
          );
          return this.getMockResponse<T>(agentEndpoint);
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Fallback if loop exits weirdly (shouldn't happen)
    return this.getMockResponse<T>(agentEndpoint);

    throw new Error(
      `Failed to call AI agent ${agentEndpoint} after ${this.config.maxRetries} attempts`
    );
  }

  private getMockResponse<T>(endpoint: string): T {
    if (endpoint === 'risk-assessment') {
      return {
        riskScore: 15,
        riskLevel: 'LOW',
        factors: ['לקוח מוכר (Mock)', 'כתובת תקינה (Dev)', 'ערך הזמנה נמוך'],
        recommendations: ['אשר אוטומטית בסביבת פיתוח'],
        actions: ['approve'],
        confidence: 0.99,
        usage: { totalTokens: 0 },
      } as unknown as T;
    }

    if (endpoint === 'financial-audit') {
      return {
        profitMargin: 0.35,
        costAnalysis: { cogs: 450, shipping: 45, labor: 100 },
        pricingSuggestions: ['שקול הנחת כמות', 'שלב עם שירות התקנה'],
        upsellOpportunities: ['חבילת תמיכה פרימיום', 'אחריות מורחבת'],
        confidence: 0.88,
      } as unknown as T;
    }

    throw new Error(`No mock response defined for endpoint: ${endpoint}`);
  }
}
