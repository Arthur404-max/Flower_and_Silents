import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AdminController } from './admin.controller';
import { AdminOrdersService } from './admin-orders.service';
import { UploadService } from './upload.service';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [AdminController],
  providers: [AdminOrdersService, UploadService],
})
export class AdminModule {}
