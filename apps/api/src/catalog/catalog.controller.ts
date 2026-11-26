import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ListProductsQueryDto } from './dto';
import { AppConfigService } from '../common/app-config.service';
import { DELIVERY_FEE, FREE_DELIVERY_FROM } from '../common/domain';

@Controller('api/v1')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly config: AppConfigService,
  ) {}

  @Get('config')
  configView() {
    return {
      demoMode: this.config.demoMode,
      storeName: 'ЦветоТишина',
      phone: null,
      address: null,
      deliveryFee: DELIVERY_FEE,
      freeDeliveryFrom: FREE_DELIVERY_FROM,
    };
  }

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('products')
  list(@Query() query: ListProductsQueryDto) {
    return this.catalog.list(query);
  }

  @Get('products/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.catalog.bySlug(slug);
  }
}
