import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('открывается после порога ошибок и использует fallback', async () => {
    const breaker = new CircuitBreaker(2, 1_000);
    const fail = async (): Promise<never> => {
      throw new Error('down');
    };
    await assert.rejects(breaker.execute(fail), /down/);
    await assert.rejects(breaker.execute(fail), /down/);
    assert.equal(breaker.currentState, 'OPEN');
    assert.equal(await breaker.execute(fail, async () => 'cached'), 'cached');
  });

  it('восстанавливается после паузы', async () => {
    const breaker = new CircuitBreaker(1, 0);
    const fail = async (): Promise<never> => {
      throw new Error('down');
    };
    await assert.rejects(breaker.execute(fail));
    assert.equal(breaker.currentState, 'HALF_OPEN');
    assert.equal(await breaker.execute(async () => 'ok'), 'ok');
    assert.equal(breaker.currentState, 'CLOSED');
  });
});
