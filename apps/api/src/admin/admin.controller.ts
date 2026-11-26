import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminAuthGuard, type AdminRequest } from '../auth/admin-auth.guard';
import { AdminMutationGuard } from '../auth/admin-mutation.guard';
import { CatalogService } from '../catalog/catalog.service';
import { CreateCategoryDto, CreateProductDto, UpdateCategoryDto, UpdateProductDto } from '../catalog/dto';
import { PrismaService } from '../common/prisma.service';
import { AdminOrdersService } from './admin-orders.service';
import { AdminProductQueryDto, ListOrdersQueryDto, UpdateOrderStatusDto } from './dto';
import { UploadService } from './upload.service';

@Controller('api/v1/admin')
@UseGuards(AdminAuthGuard, AdminMutationGuard)
export class AdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly adminOrders: AdminOrdersService,
    private readonly uploads: UploadService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.adminOrders.dashboard();
  }

  @Get('products')
  products(@Query() query: AdminProductQueryDto) {
    return this.catalog.adminProducts(query.q);
  }

  @Post('products')
  async createProduct(@Body() dto: CreateProductDto, @Req() request: AdminRequest) {
    const product = await this.catalog.createProduct(dto);
    await this.audit(request, 'CREATE_PRODUCT', 'Product', product.id);
    return product;
  }

  @Patch('products/:id')
  async updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() request: AdminRequest) {
    const product = await this.catalog.updateProduct(id, dto);
    await this.audit(request, 'UPDATE_PRODUCT', 'Product', id);
    return product;
  }

  @Delete('products/:id')
  async archiveProduct(@Param('id') id: string, @Req() request: AdminRequest) {
    const result = await this.catalog.archiveProduct(id);
    await this.audit(request, result.isActive ? 'RESTORE_PRODUCT' : 'ARCHIVE_PRODUCT', 'Product', id);
    return result;
  }

  @Get('categories')
  categories() {
    return this.catalog.adminCategories();
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto, @Req() request: AdminRequest) {
    const category = await this.catalog.createCategory(dto);
    await this.audit(request, 'CREATE_CATEGORY', 'Category', category.id);
    return category;
  }

  @Patch('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto, @Req() request: AdminRequest) {
    const category = await this.catalog.updateCategory(id, dto);
    await this.audit(request, 'UPDATE_CATEGORY', 'Category', id);
    return category;
  }

  @Post('uploads')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.uploads.save(file);
  }

  @Get('orders')
  orders(@Query() query: ListOrdersQueryDto) {
    return this.adminOrders.list(query);
  }

  @Get('orders/:id')
  order(@Param('id') id: string) {
    return this.adminOrders.detail(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Headers('if-match') version: string | undefined, @Req() request: AdminRequest) {
    return this.adminOrders.updateStatus(id, dto, version, request.admin.id);
  }

  private async audit(request: AdminRequest, action: string, entity: string, entityId: string): Promise<void> {
    await this.prisma.adminAuditLog.create({ data: { adminId: request.admin.id, action, entity, entityId } });
  }
}
