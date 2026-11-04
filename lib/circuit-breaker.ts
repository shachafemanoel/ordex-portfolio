/**
 * Circuit Breaker Implementation for External Service Reliability
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when external services (WooCommerce, Google APIs, etc.) are unavailable.
 */

export interface CircuitBreakerConfig {
  // Failure threshold before opening circuit
  failureThreshold: number;

  // Success threshold to close circuit when half-open
  successThreshold: number;

  // Time to wait before attempting to close circuit (ms)
  timeout: number;

  // Monitor window for tracking failures (ms)
  monitoringWindow: number;

  // Custom error detection function
  isError?: (error: any) => boolean;

  // Fallback function when circuit is open
  fallback?: () => Promise<any>;
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, calls fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service has recovered
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttempt?: Date;
}

export class CircuitBreaker<T = any> {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttempt?: Date;
  private failures: Date[] = [];

  constructor(
    private serviceName: string,
    private config: CircuitBreakerConfig
  ) {}

  async execute<R = T>(operation: () => Promise<R>): Promise<R> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(`Circuit breaker for ${this.serviceName} moving to HALF_OPEN state`);
      } else {
        return this.executeFallback();
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      return this.onSuccess(result);
    } catch (error) {
      return this.onFailure(error);
    }
  }

  private async executeWithTimeout<R>(operation: () => Promise<R>): Promise<R> {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout);
    });

    return Promise.race([operation(), timeoutPromise]);
  }

  private onSuccess<R>(result: R): R {
    this.recordSuccess();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.reset();
        console.log(`Circuit breaker for ${this.serviceName} CLOSED - service recovered`);
      }
    }

    return result;
  }

  private onFailure<R>(error: any): R {
    if (!this.config.isError || this.config.isError(error)) {
      this.recordFailure();

      if (this.shouldOpenCircuit()) {
        this.openCircuit();
        console.error(`Circuit breaker for ${this.serviceName} OPENED due to failures:`, error);
      }
    }

    if (this.state === CircuitState.OPEN) {
      return this.executeFallback();
    }

    throw error;
  }

  private recordSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    // Reset failure count on successful operations when closed
    if (this.state === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.failures = [];
    }
  }

  private recordFailure(): void {
    const now = new Date();
    this.failureCount++;
    this.lastFailureTime = now;
    this.failures.push(now);

    // Clean old failures outside monitoring window
    const cutoff = new Date(now.getTime() - this.config.monitoringWindow);
    this.failures = this.failures.filter((failure) => failure > cutoff);
  }

  private shouldOpenCircuit(): boolean {
    if (this.state === CircuitState.HALF_OPEN) {
      // In half-open state, any failure should open the circuit
      return true;
    }

    // Check if we've exceeded failure threshold in the monitoring window
    return this.failures.length >= this.config.failureThreshold;
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.timeout);
    this.successCount = 0;
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? new Date() >= this.nextAttempt : false;
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.failures = [];
    this.nextAttempt = undefined;
  }

  private executeFallback<R>(): R {
    if (this.config.fallback) {
      console.log(`Executing fallback for ${this.serviceName}`);
      return this.config.fallback() as R;
    }

    throw new Error(
      `Service ${this.serviceName} is currently unavailable (circuit breaker is OPEN)`
    );
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttempt: this.nextAttempt,
    };
  }

  // Manual control methods
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.timeout);
    console.log(`Circuit breaker for ${this.serviceName} manually OPENED`);
  }

  forceClose(): void {
    this.reset();
    console.log(`Circuit breaker for ${this.serviceName} manually CLOSED`);
  }

  forceHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    console.log(`Circuit breaker for ${this.serviceName} manually set to HALF_OPEN`);
  }
}

// Pre-configured circuit breakers for common services
export const wooCommerceCircuitBreaker = new CircuitBreaker('woocommerce', {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 60000, // 1 minute
  monitoringWindow: 300000, // 5 minutes
  isError: (error) => {
    // Don't trigger circuit breaker for authentication errors
    if (error?.response?.status === 401) return false;
    // Trigger for timeouts, 5xx errors, and network errors
    return !error?.response || error?.response?.status >= 500;
  },
  fallback: async () => ({
    success: false,
    message: 'WooCommerce service is temporarily unavailable. Please try again later.',
    cached: true,
  }),
});

export const geocodingCircuitBreaker = new CircuitBreaker('geocoding', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  monitoringWindow: 180000, // 3 minutes
  fallback: async () => ({
    coordinates: null,
    address: 'Address geocoding temporarily unavailable',
  }),
});

export const twilioCircuitBreaker = new CircuitBreaker('twilio', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 45000, // 45 seconds
  monitoringWindow: 300000, // 5 minutes
  fallback: async () => ({
    sent: false,
    message: 'SMS service temporarily unavailable. Notification will be queued for retry.',
  }),
});

// Circuit breaker registry for monitoring
export class CircuitBreakerRegistry {
  private static breakers = new Map<string, CircuitBreaker>();

  static register(name: string, breaker: CircuitBreaker): void {
    this.breakers.set(name, breaker);
  }

  static getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  static getHealthSummary(): {
    total: number;
    open: number;
    halfOpen: number;
    closed: number;
    healthScore: number;
  } {
    const stats = this.getAllStats();
    const total = Object.keys(stats).length;

    if (total === 0) {
      return { total: 0, open: 0, halfOpen: 0, closed: 0, healthScore: 1.0 };
    }

    const open = Object.values(stats).filter((s) => s.state === CircuitState.OPEN).length;
    const halfOpen = Object.values(stats).filter((s) => s.state === CircuitState.HALF_OPEN).length;
    const closed = Object.values(stats).filter((s) => s.state === CircuitState.CLOSED).length;

    // Health score: 1.0 = all closed, 0.0 = all open
    const healthScore = (closed + halfOpen * 0.5) / total;

    return { total, open, halfOpen, closed, healthScore };
  }
}

// Register default circuit breakers
CircuitBreakerRegistry.register('woocommerce', wooCommerceCircuitBreaker);
CircuitBreakerRegistry.register('geocoding', geocodingCircuitBreaker);
CircuitBreakerRegistry.register('twilio', twilioCircuitBreaker);

// Utility function to wrap any async operation with circuit breaker
export function withCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  const defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 30000,
    monitoringWindow: 300000,
  };

  const breaker = new CircuitBreaker(serviceName, { ...defaultConfig, ...config });
  return breaker.execute(operation);
}
