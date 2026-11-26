import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { DemoPaymentProvider } from './demo-payment.provider';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, DemoPaymentProvider],
  exports: [OrdersService],
})
export class OrdersModule {}
