import type { Order, OrderItem, OrderStatusHistory } from '@prisma/client';
import type { OrderView } from '@cvetotishina/shared';

export type OrderWithItems = Order & { items: OrderItem[] };
export type OrderWithDetails = OrderWithItems & { history: OrderStatusHistory[] };

export function serializeOrder(order: OrderWithDetails) {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    customerName: order.customerName,
    phone: order.phone,
    email: order.email,
    deliveryType: order.deliveryType,
    address: order.address,
    comment: order.comment,
    utensils: order.utensils,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    serviceFee: order.serviceFee,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    version: order.version,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      imageUrl: item.imageUrl,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    history: order.history
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        comment: entry.comment,
        actorType: entry.actorType,
        createdAt: entry.createdAt.toISOString(),
      })),
  } satisfies OrderView & { version: number; history: unknown[] };
}
