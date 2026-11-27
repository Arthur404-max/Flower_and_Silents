import type { ProductView } from '@cvetotishina/shared';
import type { AdminUser, OrderView } from '../types';

export interface LocalCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  version: number;
}

export interface LocalProduct extends ProductView {
  isActive: boolean;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  searchText: string;
}

export type LocalOrder = Omit<OrderView, 'items'> & {
  accessToken: string;
  items: Array<OrderView['items'][number] & { productId: string }>;
};

export interface LocalIdempotencyRecord {
  scope: string;
  key: string;
  requestFingerprint: string;
  response: unknown;
}

export interface LocalAuditEntry {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface LocalAdmin extends AdminUser {
  password: string;
}

export interface LocalState {
  schemaVersion: 1;
  categories: LocalCategory[];
  products: LocalProduct[];
  orders: LocalOrder[];
  admin: LocalAdmin;
  sessionEpoch: number;
  idempotency: Record<string, LocalIdempotencyRecord>;
  audit: LocalAuditEntry[];
}

interface SeedProduct {
  category: string;
  name: string;
  slug: string;
  description: string;
  composition: string;
  size: string;
  price: number;
  oldPrice: number | null;
  imageUrl: string;
  badge: string | null;
  stock: number;
}

const categories = [
  { name: 'Букеты', slug: 'bouquets', sortOrder: 10 },
  { name: 'Пионы', slug: 'peonies', sortOrder: 20 },
  { name: 'Розы', slug: 'roses', sortOrder: 30 },
  { name: 'Тюльпаны', slug: 'tulips', sortOrder: 40 },
  { name: 'Сухоцветы', slug: 'dried', sortOrder: 50 },
  { name: 'Подарки', slug: 'gifts', sortOrder: 60 },
];

// Prices match apps/api/prisma/seed.ts after its conversion to kopecks.
const products: SeedProduct[] = [
  { category: 'peonies', name: 'Нежное утро', slug: 'nezhnoe-utro', description: 'Светлый букет для тихих поздравлений и красивых повседневных моментов.', composition: 'Пионы, эвкалипт, упаковка', size: 'Высота около 45 см', price: 459000, oldPrice: 529000, imageUrl: '/images/peonies.jpg', badge: 'Выбор флориста', stock: 12 },
  { category: 'roses', name: 'Бордовая история', slug: 'bordovaya-istoriya', description: 'Сдержанный и выразительный букет из глубоких роз с зелёным акцентом.', composition: 'Розы, зелень, матовая упаковка', size: 'Высота около 50 см', price: 389000, oldPrice: null, imageUrl: '/images/roses.jpg', badge: null, stock: 18 },
  { category: 'tulips', name: 'Весеннее письмо', slug: 'vesennee-pismo', description: 'Воздушный пастельный букет, который собирает в себе свет и настроение.', composition: 'Тюльпаны, эвкалипт, бумага', size: 'Высота около 40 см', price: 249000, oldPrice: 299000, imageUrl: '/images/tulips.jpg', badge: 'Сезонный', stock: 24 },
  { category: 'bouquets', name: 'Тихая роскошь', slug: 'tihaya-roskosh', description: 'Собранный вручную микс для особенного дня без лишних слов.', composition: 'Розы, пионы, зелень, упаковка', size: 'Высота около 55 см', price: 599000, oldPrice: null, imageUrl: '/images/white-bouquet.jpg', badge: 'Премиальный', stock: 8 },
  { category: 'dried', name: 'Сохранить момент', slug: 'sohranit-moment', description: 'Сухоцветы с естественной фактурой для интерьера и долгой памяти.', composition: 'Сухоцветы, лента, упаковка', size: 'Высота около 50 см', price: 219000, oldPrice: null, imageUrl: '/images/dried-flowers.jpg', badge: null, stock: 15 },
  { category: 'gifts', name: 'Коробка заботы', slug: 'korobka-zaboty', description: 'Готовый подарочный набор с цветами для случая, когда хочется больше, чем букет.', composition: 'Цветы, подарочная коробка, открытка', size: 'Размер коробки 20 × 20 см', price: 429000, oldPrice: 499000, imageUrl: '/images/gift-box.jpg', badge: 'Готовый подарок', stock: 10 },
  { category: 'bouquets', name: 'Светлый день', slug: 'svetlyy-den', description: 'Свежий микс для дружеских встреч, благодарности и маленьких праздников.', composition: 'Сезонные цветы, зелень, упаковка', size: 'Высота около 45 см', price: 329000, oldPrice: null, imageUrl: '/images/seasonal.jpg', badge: null, stock: 20 },
  { category: 'peonies', name: 'Пудровый бриз', slug: 'pudrovyy-briz', description: 'Нежная композиция в спокойных оттенках для личных и семейных событий.', composition: 'Пионовидные розы, астильба, зелень, упаковка', size: 'Высота около 48 см', price: 499000, oldPrice: null, imageUrl: '/images/powder.jpg', badge: null, stock: 7 },
];

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function buildSearchText(product: SeedProduct): string {
  return normalizeSearchText(`${product.name} ${product.description} ${product.composition}`);
}

export function createInitialState(now = Date.now()): LocalState {
  const localCategories: LocalCategory[] = categories.map((category) => ({
    id: `category-${category.slug}`,
    ...category,
    isActive: true,
    version: 1,
  }));

  const localProducts: LocalProduct[] = products.map((product, index) => {
    const category = localCategories.find((item) => item.slug === product.category)!;
    const createdAt = new Date(now - index * 60_000).toISOString();
    const { category: _categorySlug, ...data } = product;
    return {
      ...data,
      id: `product-${product.slug}`,
      categoryId: category.id,
      category: { id: category.id, name: category.name, slug: category.slug },
      searchText: buildSearchText(product),
      isActive: true,
      version: 1,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
  });

  return {
    schemaVersion: 1,
    categories: localCategories,
    products: localProducts,
    orders: [],
    admin: {
      id: 'local-admin',
      email: 'admin@cvetotishina.local',
      name: 'Администратор',
      password: 'CvetoTishinaLocal2026!',
    },
    sessionEpoch: 0,
    idempotency: {},
    audit: [],
  };
}
