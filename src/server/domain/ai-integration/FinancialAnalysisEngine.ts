import { prisma } from '@/lib/db';
import {
  AIFinancialInsightResponse,
  AIOmniSupplyClient,
} from '@/src/server/infrastructure/ai-omnisupply-client';

export class FinancialAnalysisEngine {
  private client: AIOmniSupplyClient;

  constructor(client?: AIOmniSupplyClient) {
    this.client = client || new AIOmniSupplyClient();
  }

  async analyzeOrder(
    orderId: string,
    context: any = {}
  ): Promise<AIFinancialInsightResponse | null> {
    const order = (await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true, // Need product details for cost/category analysis
          },
        },
        // coupons: true, // Removed invalid relation
        // discount: true, // Relation to Discount model? Removed due to type error
        customer: true,
      },
    })) as any;

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const request = {
      orderId: order.id,
      orderData: {
        total: order.totalCents,
        subtotal: order.subTotalCents,
        discount: order.discountCents,
        shipping: order.shippingCents,
        currency: order.currency,
        items: order.items.map((item: any) => ({
          sku: item.sku,
          name: item.name,
          qty: item.qty,
          price: item.priceCents,
          total: item.totalCents,
          category: item.product?.type, // Using product type as proxy for category if needed
          costEstimate: item.product?.basePriceCents, // Assuming basePrice is cost or base
        })),
        customerSegment: order.customer.segment,
        clv: order.customer.clvCents,
      },
      context,
    };

    const startTime = Date.now();
    let aiResponse: AIFinancialInsightResponse;
    try {
      aiResponse = await this.client.analyzeFinancials(request);
    } catch (error: any) {
      await prisma.aIAgentLog.create({
        data: {
          orderId: order.id,
          agentType: 'FINANCIAL_ANALYST',
          action: 'ANALYZE_FINANCIALS',
          error: error.message,
          duration: Date.now() - startTime,
        },
      });
      throw error;
    }
    const duration = Date.now() - startTime;

    // Save Insight
    await prisma.aIFinancialInsight.create({
      data: {
        orderId: order.id,
        profitMargin: aiResponse.profitMargin,
        costAnalysis: aiResponse.costAnalysis,
        pricingSuggestions: aiResponse.pricingSuggestions,
        upsellOpportunities: aiResponse.upsellOpportunities,
        confidence: aiResponse.confidence,
        model: 'gpt-4o',
        agentVersion: 'v1',
        processingTime: duration,
      },
    });

    // Log success
    await prisma.aIAgentLog.create({
      data: {
        orderId: order.id,
        agentType: 'FINANCIAL_ANALYST',
        action: 'ANALYZE_FINANCIALS',
        input: JSON.stringify(request),
        output: JSON.stringify(aiResponse),
        duration,
        model: 'gpt-4o',
      },
    });

    return aiResponse;
  }

  async getLatestInsight(orderId: string) {
    return prisma.aIFinancialInsight.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
