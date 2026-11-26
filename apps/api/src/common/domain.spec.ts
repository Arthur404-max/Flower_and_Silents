import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateTotals, canTransitionOrderStatus, hashToken, normalizeCart } from './domain';

describe('normalizeCart', () => {
  it('объединяет одинаковые товары', () => {
    assert.deepEqual(normalizeCart([
      { productId: 'a', quantity: 1 },
      { productId: 'a', quantity: 2 },
      { productId: 'b', quantity: 1 },
    ]), [
      { productId: 'a', quantity: 3 },
      { productId: 'b', quantity: 1 },
    ]);
  });

  it('отклоняет пустую корзину и неверное количество', () => {
    assert.throws(() => normalizeCart([]), /Корзина пуста/);
    assert.throws(() => normalizeCart([{ productId: 'a', quantity: 0 }]));
    assert.throws(() => normalizeCart([{ productId: 'a', quantity: 1.5 }]));
  });

  it('ограничивает количество одного товара', () => {
    assert.throws(() => normalizeCart([
      { productId: 'a', quantity: 15 },
      { productId: 'a', quantity: 10 },
    ]), /Не более 20/);
  });
});

describe('calculateTotals', () => {
  it('не добавляет доставку для самовывоза', () => {
    assert.deepEqual(calculateTotals(100_000, 'PICKUP'), { subtotal: 100_000, deliveryFee: 0, serviceFee: 0, total: 100_000 });
  });

  it('добавляет тариф ниже порога бесплатной доставки', () => {
    assert.deepEqual(calculateTotals(499_999, 'DELIVERY'), { subtotal: 499_999, deliveryFee: 290_000, serviceFee: 0, total: 789_999 });
  });

  it('делает доставку бесплатной начиная с порога', () => {
    assert.equal(calculateTotals(500_000, 'DELIVERY').deliveryFee, 0);
  });
});

describe('canTransitionOrderStatus', () => {
  it('разрешает только следующий рабочий статус', () => {
    assert.equal(canTransitionOrderStatus('AWAITING_PAYMENT', 'NEW'), true);
    assert.equal(canTransitionOrderStatus('NEW', 'ASSEMBLING'), true);
    assert.equal(canTransitionOrderStatus('NEW', 'DELIVERED'), false);
    assert.equal(canTransitionOrderStatus('DELIVERED', 'CANCELLED'), false);
  });

  it('разрешает отмену до передачи курьеру', () => {
    assert.equal(canTransitionOrderStatus('ASSEMBLING', 'CANCELLED'), true);
    assert.equal(canTransitionOrderStatus('PAYMENT_FAILED', 'CANCELLED'), true);
    assert.equal(canTransitionOrderStatus('DELIVERING', 'CANCELLED'), false);
  });
});

describe('hashToken', () => {
  it('детерминированно скрывает исходный токен', () => {
    assert.equal(hashToken('secret'), hashToken('secret'));
    assert.notEqual(hashToken('secret'), 'secret');
    assert.notEqual(hashToken('secret'), hashToken('other'));
  });
});
