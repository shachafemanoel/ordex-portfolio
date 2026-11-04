import { prisma } from '@/lib/db';
import {
  AIOmniSupplyClient,
  AIRiskAssessmentResponse,
} from '@/src/server/infrastructure/ai-omnisupply-client';

export class RiskAssessmentEngine {
  private client: AIOmniSupplyClient;

  constructor(client?: AIOmniSupplyClient) {
    this.client = client || new AIOmniSupplyClient();
  }

  async assessOrder(orderId: string, context: any = {}): Promise<AIRiskAssessmentResponse | null> {
    // 1. Fetch Order with necessary relations
    const order = (await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
        billingAddress: true,
        shippingAddress: true,
        payments: true,
        // history: { orderBy: { createdAt: 'desc' }, take: 5 }, // Removed invalid relation
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })) as any;

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // 2. Prepare request for AI
    const request = {
      orderId: order.id,
      orderData: {
        total: order.totalCents,
        currency: order.currency,
        customer: {
          id: order.customerId,
          email: order.customer.email,
          phone: order.customer.phone,
          riskLevel: order.customer.riskLevel,
          ordersCount: order.customer.ordersCount,
          clv: order.customer.clvCents,
        },
        items: order.items.map((item: any) => ({
          sku: item.sku,
          qty: item.qty,
          price: item.priceCents,
          total: item.totalCents,
        })),
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        paymentStatus: order.paymentStatus,
        history: order.statusHistory,
      },
      context,
    };

    // 3. Call AI Client
    const startTime = Date.now();
    let aiResponse: AIRiskAssessmentResponse;
    try {
      aiResponse = await this.client.assessRisk(request);
    } catch (error: any) {
      // Log failure
      await prisma.aIAgentLog.create({
        data: {
          orderId: order.id,
          agentType: 'RISK_ASSESSOR',
          action: 'ASSESS_RISK',
          error: error.message,
          duration: Date.now() - startTime,
        },
      });
      throw error;
    }
    const duration = Date.now() - startTime;

    // 4. Save Assessment
    const assessment = await prisma.aIRiskAssessment.create({
      data: {
        orderId: order.id,
        overallRiskScore: aiResponse.riskScore,
        riskLevel: aiResponse.riskLevel,
        riskFactors: aiResponse.factors,
        recommendations: aiResponse.recommendations,
        mitigationActions: aiResponse.actions,
        confidence: aiResponse.confidence,
        model: 'gpt-4o', // Should come from client config response ideally, or metadata
        agentVersion: 'v1',
        processingTime: duration,
        status: 'COMPLETED',
        tokenUsage: aiResponse.usage?.totalTokens,
      },
    });

    // 5. Update Order with latest assessment summary
    await prisma.order.update({
      where: { id: orderId },
      data: {
        lastRiskAssessmentId: assessment.id,
        aiSuggestedAction: aiResponse.actions[0] || null, // Take first action as primary suggestion
        aiConfidenceLevel: aiResponse.confidence,
        aiLastAnalyzedAt: new Date(),
      },
    });

    // 6. Log success
    await prisma.aIAgentLog.create({
      data: {
        orderId: order.id,
        agentType: 'RISK_ASSESSOR',
        action: 'ASSESS_RISK',
        input: JSON.stringify(request), // Careful with size/PII? Schema says Json.
        output: JSON.stringify(aiResponse),
        duration,
        tokensUsed: aiResponse.usage?.totalTokens,
        model: 'gpt-4o',
      },
    });

    return aiResponse;
  }

  async getLatestAssessment(orderId: string) {
    return prisma.aIRiskAssessment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
