import { ServiceUnavailableException } from '@nestjs/common';
import { CircuitBreaker } from '../common/circuit-breaker';

export class DemoPaymentProvider {
  private readonly breaker = new CircuitBreaker(3, 10_000);

  async charge(orderId: string, amount: number): Promise<{ provider: string; reference: string }> {
    return this.breaker.execute(async () => {
      if (amount <= 0) throw new Error('Invalid payment amount');
      return { provider: 'DEMO', reference: `demo-${orderId.slice(0, 8)}` };
    }).catch(() => {
      throw new ServiceUnavailableException('Платёжный сервис временно недоступен');
    });
  }
}
