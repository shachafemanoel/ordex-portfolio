import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { geminiClient } from '../../lib/ai/gemini-client';
import { AIOmniSupplyClient } from '../../src/server/infrastructure/ai-omnisupply-client';

describe('AI Mock Verification', () => {
  it('should return mock data from OmniSupply Client when API key is missing', async () => {
    const client = new AIOmniSupplyClient();
    // Force empty API key
    (client as any).config.apiKey = '';

    const result = await client.assessRisk({
      orderId: 'test-order-id',
      orderData: {},
    });

    expect(result.riskLevel).toBe('LOW');
    expect(result.recommendations).toContain('Approve automatically in dev');
  });

  it('should return mock text from Gemini Core when API key is missing', async () => {
    // Force unconfigured state
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = '';

    try {
      const result = await geminiClient.generateContent('Hello, AI!');

      expect(result.success).toBe(true);
      expect(result.text).toContain('[Mock]');
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it('should return mock structured data from Gemini Core when API key is missing', async () => {
    // Force unconfigured state
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = '';

    try {
      const TestSchema = z.object({
        sentiment: z.enum(['positive', 'negative']),
        score: z.number(),
        tags: z.array(z.string()),
      });

      const result = await geminiClient.analyzeWithStructuredOutput('Analyze this', z.object({}), {
        taskType: 'generic_structured',
        zodSchema: TestSchema,
      });

      const data = result.result as any;
      expect(data.sentiment).toBe('positive');
      expect(data.score).toBe(0);
      expect(Array.isArray(data.tags)).toBe(true);
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });
});
