import { createHash } from 'node:crypto';
import type { DeliveryType, OrderStatus } from '@cvetotishina/shared';

export const DELIVERY_FEE = 290_000;
export const FREE_DELIVERY_FROM = 500_000;
export const MAX_LINE_QUANTITY = 20;

export interface NormalizedCartLine {
  productId: string;
  quantity: number;
}

export interface OrderTotals {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
}

export function normalizeCart(
  lines: Array<{ productId: string; quantity: number }>,
): NormalizedCartLine[] {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId || !Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Некорректное количество товара');
    }
    const quantity = (quantities.get(line.productId) ?? 0) + line.quantity;
    if (quantity > MAX_LINE_QUANTITY) {
      throw new Error(`Не более ${MAX_LINE_QUANTITY} единиц одного товара`);
    }
    quantities.set(line.productId, quantity);
  }
  if (quantities.size === 0) {
    throw new Error('Корзина пуста');
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export function calculateTotals(subtotal: number, deliveryType: DeliveryType): OrderTotals {
  const deliveryFee =
    deliveryType === 'DELIVERY' && subtotal < FREE_DELIVERY_FROM ? DELIVERY_FEE : 0;
  return {
    subtotal,
    deliveryFee,
    serviceFee: 0,
    total: subtotal + deliveryFee,
  };
}

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  const flow: OrderStatus[] = ['AWAITING_PAYMENT', 'NEW', 'ASSEMBLING', 'DELIVERING', 'DELIVERED'];
  const fromIndex = flow.indexOf(from);
  const toIndex = flow.indexOf(to);
  if (fromIndex >= 0 && toIndex === fromIndex + 1) return true;
  if (to === 'PAYMENT_FAILED' && from === 'AWAITING_PAYMENT') return true;
  if (to === 'CANCELLED' && ['AWAITING_PAYMENT', 'NEW', 'ASSEMBLING', 'PAYMENT_FAILED'].includes(from)) return true;
  return false;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
