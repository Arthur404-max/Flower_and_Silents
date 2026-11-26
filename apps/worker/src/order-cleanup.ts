import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MetricsService } from './metrics.service';
import { QueueService } from './queue.service';

@Injectable()
export class OrderCleanup implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.expireOrders();
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async expireOrders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const threshold = new Date(Date.now() - 30 * 60_000);
      const orders = await this.prisma.order.findMany({
        where: { status: { in: ['AWAITING_PAYMENT', 'PAYMENT_FAILED'] }, createdAt: { lt: threshold } },
        include: { items: true },
        take: 50,
      });
      for (const order of orders) {
        await this.prisma.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: { id: order.id, status: { in: ['AWAITING_PAYMENT', 'PAYMENT_FAILED'] }, createdAt: { lt: threshold } },
            data: { status: 'CANCELLED', version: { increment: 1 } },
          });
          if (updated.count !== 1) return;
          for (const item of order.items) {
            if (item.productId) {
              await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity }, version: { increment: 1 } } });
            }
          }
          await tx.orderStatusHistory.create({
            data: { orderId: order.id, fromStatus: order.status, toStatus: 'CANCELLED', comment: 'Оплата не получена в течение 30 минут', actorType: 'SYSTEM' },
          });
          await tx.outboxEvent.create({
            data: { aggregateType: 'Order', aggregateId: order.id, type: 'order.expired', payload: { orderId: order.id, number: order.number } },
          });
        });
        this.metrics.expiredOrders.inc();
      }
      if (orders.length > 0) await this.queue.invalidateCatalog();
      await this.prisma.outboxEvent.deleteMany({ where: { status: 'PUBLISHED', publishedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', component: 'cleanup', error: error instanceof Error ? error.name : 'UnknownError' }));
    } finally {
      this.running = false;
    }
  }
}
