import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { calculateTotals, hashToken, normalizeCart } from '../common/domain';
import { MetricsService } from '../common/metrics.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { CreateOrderDto, DemoPaymentDto, QuoteCartDto } from './dto';
import { DemoPaymentProvider } from './demo-payment.provider';
import { serializeOrder } from './order-serializer';

export interface QuoteLine {
  productId: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
}

export interface CreateOrderResult {
  order: ReturnType<typeof serializeOrder>;
  accessToken: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly redis: RedisService,
    private readonly payments: DemoPaymentProvider,
  ) {}

  async quote(dto: QuoteCartDto) {
    const lines = normalizeCart(dto.items);
    const products = await this.prisma.product.findMany({
      where: { id: { in: lines.map((line) => line.productId) }, isActive: true, category: { isActive: true } },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const items: QuoteLine[] = lines.map((line) => {
      const product = productMap.get(line.productId);
      if (!product) throw new NotFoundException('Один из товаров больше недоступен');
      if (product.stock < line.quantity) throw new ConflictException(`«${product.name}»: доступно ${product.stock} шт.`);
      return {
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        unitPrice: product.price,
        quantity: line.quantity,
        lineTotal: product.price * line.quantity,
        stock: product.stock,
      };
    });
    const totals = calculateTotals(items.reduce((sum, item) => sum + item.lineTotal, 0), dto.deliveryType);
    return { items, ...totals };
  }

  async create(dto: CreateOrderDto, idempotencyKey: string): Promise<CreateOrderResult> {
    this.validateKey(idempotencyKey);
    const scope = 'order:create';
    const requestHash = this.hashBody(dto);
    const replay = await this.findReplay<CreateOrderResult>(scope, idempotencyKey, requestHash);
    if (replay) return replay;

    if (dto.deliveryType === 'DELIVERY' && !dto.address?.trim()) {
      throw new BadRequestException('Укажите адрес доставки');
    }
    const lines = normalizeCart(dto.items);
    const publicToken = randomBytes(32).toString('base64url');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: lines.map((line) => line.productId) }, isActive: true, category: { isActive: true } },
        });
        const productMap = new Map(products.map((product) => [product.id, product]));
        const items = lines.map((line) => {
          const product = productMap.get(line.productId);
          if (!product) throw new NotFoundException('Один из товаров больше недоступен');
          return { product, quantity: line.quantity };
        });

        for (const { product, quantity } of items) {
          const updated = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: quantity } },
            data: { stock: { decrement: quantity }, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new ConflictException(`«${product.name}»: недостаточно товара`);
        }

        const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
        const totals = calculateTotals(subtotal, dto.deliveryType);
        const number = this.orderNumber();
        const order = await tx.order.create({
          data: {
            number,
            publicTokenHash: hashToken(publicToken),
            customerName: dto.customerName.trim(),
            phone: dto.phone.trim(),
            email: dto.email?.trim().toLowerCase() || null,
            deliveryType: dto.deliveryType,
            address: dto.deliveryType === 'DELIVERY' ? dto.address!.trim() : null,
            comment: dto.comment?.trim() || null,
            utensils: dto.utensils,
            ...totals,
            status: 'AWAITING_PAYMENT',
            paymentStatus: 'PENDING',
            items: {
              create: items.map(({ product, quantity }) => ({
                productId: product.id,
                name: product.name,
                imageUrl: product.imageUrl,
                unitPrice: product.price,
                quantity,
                lineTotal: product.price * quantity,
              })),
            },
            history: { create: { toStatus: 'AWAITING_PAYMENT', comment: 'Заказ создан', actorType: 'CUSTOMER' } },
            payments: { create: { provider: 'DEMO', amount: totals.total, status: 'PENDING' } },
          },
          include: { items: true, history: true },
        });
        const body = { order: serializeOrder(order), accessToken: publicToken };
        await tx.idempotencyRecord.create({
          data: { scope, key: idempotencyKey, requestHash, responseStatus: 201, responseBody: body },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Order',
            aggregateId: order.id,
            type: 'order.created',
            payload: { orderId: order.id, number: order.number, total: order.total },
          },
        });
        return body;
      });
      this.metrics.ordersCreated.inc();
      await this.redis.invalidate('catalog:v2:*');
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.findReplay<CreateOrderResult>(scope, idempotencyKey, requestHash);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async publicOrder(number: string, token: string) {
    if (typeof token !== 'string' || token.length < 20) throw new BadRequestException('Токен доступа к заказу обязателен');
    const order = await this.prisma.order.findFirst({
      where: { number, publicTokenHash: hashToken(token) },
      include: { items: true, history: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден или ссылка доступа недействительна');
    return { order: serializeOrder(order) };
  }

  async payDemo(number: string, dto: DemoPaymentDto, idempotencyKey: string): Promise<{ order: ReturnType<typeof serializeOrder> }> {
    this.validateKey(idempotencyKey);
    const scope = `payment:${number}`;
    const requestHash = this.hashBody(dto);
    const replay = await this.findReplay<{ order: ReturnType<typeof serializeOrder> }>(scope, idempotencyKey, requestHash);
    if (replay) return replay;

    const existing = await this.prisma.order.findFirst({
      where: { number, publicTokenHash: hashToken(dto.token) },
      include: { items: true, history: true },
    });
    if (!existing) throw new NotFoundException('Заказ не найден или ссылка доступа недействительна');
    if (existing.paymentStatus === 'PAID') return { order: serializeOrder(existing) };
    if (existing.status !== 'AWAITING_PAYMENT' && existing.status !== 'PAYMENT_FAILED') {
      throw new ConflictException('Этот заказ нельзя оплатить');
    }

    const payment = await this.payments.charge(existing.id, existing.total);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: existing.id, status: { in: ['AWAITING_PAYMENT', 'PAYMENT_FAILED'] }, paymentStatus: { in: ['PENDING', 'FAILED'] } },
          data: { status: 'NEW', paymentStatus: 'PAID', paidAt: new Date(), version: { increment: 1 } },
        });
        if (updated.count !== 1) throw new ConflictException('Статус оплаты уже изменился');
        await tx.paymentAttempt.upsert({
          where: { orderId_provider: { orderId: existing.id, provider: 'DEMO' } },
          create: { orderId: existing.id, provider: 'DEMO', status: 'PAID', amount: existing.total },
          update: { status: 'PAID', amount: existing.total },
        });
        await tx.orderStatusHistory.create({
          data: { orderId: existing.id, fromStatus: existing.status, toStatus: 'NEW', comment: 'Демо-оплата подтверждена', actorType: 'PAYMENT' },
        });
        const order = await tx.order.findUniqueOrThrow({ where: { id: existing.id }, include: { items: true, history: true } });
        const body = { order: serializeOrder(order) };
        await tx.idempotencyRecord.create({
          data: { scope, key: idempotencyKey, requestHash, responseStatus: 200, responseBody: body },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Order',
            aggregateId: order.id,
            type: 'order.paid',
            payload: { orderId: order.id, number: order.number, total: order.total, reference: payment.reference },
          },
        });
        return body;
      });
      this.metrics.ordersPaid.inc();
      this.metrics.orderRevenue.inc(existing.total);
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replayBody = await this.findReplay<{ order: ReturnType<typeof serializeOrder> }>(scope, idempotencyKey, requestHash);
        if (replayBody) return replayBody;
      }
      throw error;
    }
  }

  private async findReplay<T>(scope: string, key: string, requestHash: string): Promise<T | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { scope_key: { scope, key } } });
    if (!record) return null;
    if (record.requestHash !== requestHash) throw new ConflictException('Этот ключ уже использован для другого запроса');
    return record.responseBody as T;
  }

  private validateKey(key: string): void {
    if (typeof key !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(key)) {
      throw new BadRequestException('Idempotency-Key обязателен (8–100 символов)');
    }
  }

  private hashBody(body: unknown): string {
    return createHash('sha256').update(JSON.stringify(body)).digest('hex');
  }

  private orderNumber(): string {
    const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
    return `CT-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }
}
