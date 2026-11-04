import { NextRequest, NextResponse } from 'next/server';
import { CircuitBreakerRegistry } from '@/lib/circuit-breaker';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest) {
  try {
    const stats = CircuitBreakerRegistry.getAllStats();
    const summary = CircuitBreakerRegistry.getHealthSummary();

    return NextResponse.json({
      success: true,
      data: {
        summary,
        circuitBreakers: stats,
        recommendations: generateRecommendations(stats),
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('Circuit breaker monitoring failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Circuit breaker monitoring failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(stats: Record<string, any>): string[] {
  const recommendations: string[] = [];

  for (const [service, stat] of Object.entries(stats)) {
    if (stat.state === 'OPEN') {
      recommendations.push(
        `Service ${service} is unavailable. Check external service status and logs.`
      );
    } else if (stat.state === 'HALF_OPEN') {
      recommendations.push(`Service ${service} is recovering. Monitor success rate closely.`);
    } else if (stat.failureCount > 0) {
      recommendations.push(
        `Service ${service} has recent failures. Consider investigating root cause.`
      );
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('All circuit breakers are healthy. No action required.');
  }

  return recommendations;
}
