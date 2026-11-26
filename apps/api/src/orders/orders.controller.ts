import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CreateOrderDto, DemoPaymentDto, QuoteCartDto } from './dto';
import { OrdersService } from './orders.service';

@Controller('api/v1')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('cart/quote')
  @HttpCode(200)
  quote(@Body() dto: QuoteCartDto) {
    return this.orders.quote(dto);
  }

  @Post('orders')
  @HttpCode(201)
  create(@Body() dto: CreateOrderDto, @Headers('idempotency-key') idempotencyKey: string) {
    return this.orders.create(dto, idempotencyKey);
  }

  @Get('orders/:number')
  publicOrder(@Param('number') number: string, @Query('token') token: string) {
    return this.orders.publicOrder(number, token);
  }

  @Post('orders/:number/payments/demo')
  @HttpCode(200)
  payDemo(@Param('number') number: string, @Body() dto: DemoPaymentDto, @Headers('idempotency-key') idempotencyKey: string) {
    return this.orders.payDemo(number, dto, idempotencyKey);
  }
}
