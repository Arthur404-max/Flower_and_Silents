import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ORDER_STATUSES, type OrderStatus } from '@cvetotishina/shared';
import { canTransitionOrderStatus } from '../common/domain';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ListOrdersQueryDto, UpdateOrderStatusDto } from './dto';
import { serializeOrder } from '../orders/order-serializer';

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async list(query: ListOrdersQueryDto) {
    const orders = await this.prisma.order.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.q
          ? { OR: [{ number: { contains: query.q, mode: 'insensitive' } }, { customerName: { contains: query.q, mode: 'insensitive' } }, { phone: { contains: query.q } }] }
          : {}),
      },
      include: { items: true, history: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = orders.slice(0, query.limit);
    return {
      items: page.map(serializeOrder),
      nextCursor: orders.length > query.limit ? page.at(-1)?.id ?? null : null,
      total: await this.prisma.order.count({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.q
            ? { OR: [{ number: { contains: query.q, mode: 'insensitive' } }, { customerName: { contains: query.q, mode: 'insensitive' } }, { phone: { contains: query.q } }] }
            : {}),
        },
      }),
    };
  }

  async detail(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true, history: true } });
    if (!order) throw new NotFoundException('Заказ не найден');
    return serializeOrder(order);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, expectedVersion: string | undefined, adminId: string) {
    const version = Number(expectedVersion);
    if (!Number.isInteger(version) || version < 1) throw new ConflictException('Требуется заголовок If-Match с версией заказа');
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new NotFoundException('Заказ не найден');
      if (order.version !== version) throw new ConflictException('Заказ уже изменён. Обновите данные');
      if (!canTransitionOrderStatus(order.status, dto.status)) {
        throw new ConflictException(`Переход «${order.status}» → «${dto.status}» недопустим`);
      }
      if (dto.status === 'CANCELLED') {
        for (const item of order.items) {
          if (item.productId) {
            await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity }, version: { increment: 1 } } });
          }
        }
      }
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          paymentStatus: dto.status === 'CANCELLED' && order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus,
          version: { increment: 1 },
          history: { create: { fromStatus: order.status, toStatus: dto.status, comment: dto.comment?.trim() || null, actorType: 'ADMIN' } },
        },
        include: { items: true, history: true },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Order',
          aggregateId: order.id,
          type: dto.status === 'CANCELLED' ? 'order.cancelled' : 'order.status_changed',
          payload: { orderId: order.id, number: order.number, status: dto.status },
        },
      });
      await tx.adminAuditLog.create({
        data: { adminId, action: 'UPDATE_ORDER_STATUS', entity: 'Order', entityId: order.id, details: { from: order.status, to: dto.status } },
      });
      return updated;
    });
    if (dto.status === 'CANCELLED') await this.redis.invalidate('catalog:v2:*');
    return serializeOrder(result);
  }

  async dashboard() {
    const [grouped, paid, lowStock, recent] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { total: true }, _count: { _all: true } }),
      this.prisma.product.count({ where: { isActive: true, stock: { lte: 3 } } }),
      this.prisma.order.findMany({ include: { items: true, history: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    const counts = Object.fromEntries(grouped.map((entry) => [entry.status, entry._count._all]));
    const statuses = Object.fromEntries(ORDER_STATUSES.map((status) => [status, counts[status] ?? 0])) as Record<OrderStatus, number>;
    return {
      statuses,
      paidOrders: paid._count._all,
      revenue: paid._sum.total ?? 0,
      lowStock,
      recent: recent.map(serializeOrder),
    };
  }
}
