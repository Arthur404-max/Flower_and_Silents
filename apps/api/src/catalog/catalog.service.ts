import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Category, type Product } from '@prisma/client';
import type { ProductView } from '@cvetotishina/shared';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { slugify } from '../common/slug';
import { buildProductSearchText, normalizeSearchText } from '../common/search';
import { CreateCategoryDto, CreateProductDto, ListProductsQueryDto, UpdateCategoryDto, UpdateProductDto } from './dto';

type ProductWithCategory = Prisma.ProductGetPayload<{ include: { category: true } }>;
type AdminProductView = ProductView & { isActive: boolean; version: number; createdAt: string; updatedAt: string };

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async categories(): Promise<Category[]> {
    const cached = await this.redis.getJson<Category[]>('catalog:v2:categories');
    if (cached) return cached;
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    await this.redis.setJson('catalog:v2:categories', categories, 300);
    return categories;
  }

  async list(query: ListProductsQueryDto): Promise<{ items: ProductView[]; nextCursor: string | null }> {
    const normalized = {
      q: normalizeSearchText(query.q?.trim() ?? ''),
      category: query.category ?? '',
      sort: query.sort,
      cursor: query.cursor ?? '',
      limit: query.limit,
    };
    const key = `catalog:v2:products:${Buffer.from(JSON.stringify(normalized)).toString('base64url')}`;
    const cached = await this.redis.getJson<{ items: ProductView[]; nextCursor: string | null }>(key);
    if (cached) return cached;

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      normalized.sort === 'price-asc'
        ? [{ price: 'asc' }, { id: 'asc' }]
        : normalized.sort === 'price-desc'
          ? [{ price: 'desc' }, { id: 'asc' }]
          : normalized.sort === 'newest'
            ? [{ createdAt: 'desc' }, { id: 'asc' }]
            : [{ stock: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(normalized.category ? { category: { slug: normalized.category, isActive: true } } : {}),
        ...(normalized.q ? { searchText: { contains: normalized.q } } : {}),
      },
      include: { category: true },
      orderBy,
      take: normalized.limit + 1,
      ...(normalized.cursor ? { cursor: { id: normalized.cursor }, skip: 1 } : {}),
    });
    const hasMore = products.length > normalized.limit;
    const page = products.slice(0, normalized.limit);
    const result = {
      items: page.map((product) => this.toProductView(product)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    };
    await this.redis.setJson(key, result, 300);
    return result;
  }

  async bySlug(slug: string): Promise<ProductView> {
    const key = `catalog:v2:product:${slug}`;
    const cached = await this.redis.getJson<ProductView>(key);
    if (cached) return cached;
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true, category: { isActive: true } },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Товар не найден');
    const view = this.toProductView(product);
    await this.redis.setJson(key, view, 300);
    return view;
  }

  async related(categoryId: string, excludeId: string): Promise<ProductView[]> {
    const products = await this.prisma.product.findMany({
      where: { categoryId, isActive: true, id: { not: excludeId }, category: { isActive: true } },
      include: { category: true },
      orderBy: [{ stock: 'desc' }, { createdAt: 'desc' }],
      take: 4,
    });
    return products.map((product) => this.toProductView(product));
  }

  async adminProducts(q = ''): Promise<AdminProductView[]> {
    const products = await this.prisma.product.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] } : {},
      include: { category: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
    return products.map((product) => this.toAdminProductView(product));
  }

  async createProduct(dto: CreateProductDto): Promise<AdminProductView> {
    await this.ensureCategory(dto.categoryId);
    const product = await this.prisma.product.create({
      data: {
        ...dto,
        price: this.toKopecks(dto.price),
        oldPrice: dto.oldPrice == null ? null : this.toKopecks(dto.oldPrice),
        slug: dto.slug ?? slugify(dto.name),
        searchText: buildProductSearchText(dto.name, dto.description, dto.composition),
      },
      include: { category: true },
    });
    await this.invalidate();
    return this.toAdminProductView(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<AdminProductView> {
    if (dto.categoryId) await this.ensureCategory(dto.categoryId);
    const current = await this.prisma.product.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Товар не найден');
    const { expectedVersion, price, oldPrice, ...data } = dto;
    const searchText = buildProductSearchText(
      dto.name ?? current.name,
      dto.description ?? current.description,
      dto.composition ?? current.composition,
    );
    const updated = await this.prisma.product.updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...data,
        searchText,
        ...(price === undefined ? {} : { price: this.toKopecks(price) }),
        ...(oldPrice === undefined ? {} : { oldPrice: oldPrice === null ? null : this.toKopecks(oldPrice) }),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.product.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException('Товар не найден');
      throw new ConflictException('Товар уже изменён. Обновите данные перед сохранением');
    }
    await this.invalidate();
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true } });
    return this.toAdminProductView(product);
  }

  async archiveProduct(id: string): Promise<{ id: string; isActive: boolean }> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Товар не найден');
    const updated = await this.prisma.product.update({ where: { id }, data: { isActive: !product.isActive, version: { increment: 1 } } });
    await this.invalidate();
    return { id: updated.id, isActive: updated.isActive };
  }

  async adminCategories(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.create({ data: { ...dto, slug: dto.slug ?? slugify(dto.name) } });
    await this.invalidate();
    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Категория не найдена');
    const category = await this.prisma.category.update({ where: { id }, data: dto });
    await this.invalidate();
    return category;
  }

  private async ensureCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Категория не найдена');
  }

  private async invalidate(): Promise<void> {
    await this.redis.invalidate('catalog:v2:*');
  }

  private toKopecks(value: number): number {
    return Math.round(value * 100);
  }

  private toProductView(product: ProductWithCategory): ProductView {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      composition: product.composition,
      size: product.size,
      price: product.price,
      oldPrice: product.oldPrice,
      imageUrl: product.imageUrl,
      badge: product.badge,
      stock: product.stock,
      categoryId: product.categoryId,
      category: { id: product.category.id, name: product.category.name, slug: product.category.slug },
    };
  }

  private toAdminProductView(product: ProductWithCategory): AdminProductView {
    return {
      ...this.toProductView(product),
      isActive: product.isActive,
      version: product.version,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
