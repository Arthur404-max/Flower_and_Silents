import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { buildProductSearchText } from '../src/common/search';

dotenv.config({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

const categories = [
  { name: 'Букеты', slug: 'bouquets', sortOrder: 10 },
  { name: 'Пионы', slug: 'peonies', sortOrder: 20 },
  { name: 'Розы', slug: 'roses', sortOrder: 30 },
  { name: 'Тюльпаны', slug: 'tulips', sortOrder: 40 },
  { name: 'Сухоцветы', slug: 'dried', sortOrder: 50 },
  { name: 'Подарки', slug: 'gifts', sortOrder: 60 },
];

const products = [
  { category: 'peonies', name: 'Нежное утро', slug: 'nezhnoe-utro', description: 'Светлый букет для тихих поздравлений и красивых повседневных моментов.', composition: 'Пионы, эвкалипт, упаковка', size: 'Высота около 45 см', price: 4590, oldPrice: 5290, imageUrl: '/images/peonies.jpg', badge: 'Выбор флориста', stock: 12 },
  { category: 'roses', name: 'Бордовая история', slug: 'bordovaya-istoriya', description: 'Сдержанный и выразительный букет из глубоких роз с зелёным акцентом.', composition: 'Розы, зелень, матовая упаковка', size: 'Высота около 50 см', price: 3890, oldPrice: null, imageUrl: '/images/roses.jpg', badge: null, stock: 18 },
  { category: 'tulips', name: 'Весеннее письмо', slug: 'vesennee-pismo', description: 'Воздушный пастельный букет, который собирает в себе свет и настроение.', composition: 'Тюльпаны, эвкалипт, бумага', size: 'Высота около 40 см', price: 2490, oldPrice: 2990, imageUrl: '/images/tulips.jpg', badge: 'Сезонный', stock: 24 },
  { category: 'bouquets', name: 'Тихая роскошь', slug: 'tihaya-roskosh', description: 'Собранный вручную микс для особенного дня без лишних слов.', composition: 'Розы, пионы, зелень, упаковка', size: 'Высота около 55 см', price: 5990, oldPrice: null, imageUrl: '/images/white-bouquet.jpg', badge: 'Премиальный', stock: 8 },
  { category: 'dried', name: 'Сохранить момент', slug: 'sohranit-moment', description: 'Сухоцветы с естественной фактурой для интерьера и долгой памяти.', composition: 'Сухоцветы, лента, упаковка', size: 'Высота около 50 см', price: 2190, oldPrice: null, imageUrl: '/images/dried-flowers.jpg', badge: null, stock: 15 },
  { category: 'gifts', name: 'Коробка заботы', slug: 'korobka-zaboty', description: 'Готовый подарочный набор с цветами для случая, когда хочется больше, чем букет.', composition: 'Цветы, подарочная коробка, открытка', size: 'Размер коробки 20 × 20 см', price: 4290, oldPrice: 4990, imageUrl: '/images/gift-box.jpg', badge: 'Готовый подарок', stock: 10 },
  { category: 'bouquets', name: 'Светлый день', slug: 'svetlyy-den', description: 'Свежий микс для дружеских встреч, благодарности и маленьких праздников.', composition: 'Сезонные цветы, зелень, упаковка', size: 'Высота около 45 см', price: 3290, oldPrice: null, imageUrl: '/images/seasonal.jpg', badge: null, stock: 20 },
  { category: 'peonies', name: 'Пудровый бриз', slug: 'pudrovyy-briz', description: 'Нежная композиция в спокойных оттенках для личных и семейных событий.', composition: 'Пионовидные розы, зелень, упаковка', size: 'Высота около 48 см', price: 4990, oldPrice: null, imageUrl: '/images/peonies.jpg', badge: null, stock: 7 },
];

async function main(): Promise<void> {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: {},
    });
  }

  for (const product of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: product.category } });
    const { category: _categorySlug, ...data } = product;
    await prisma.product.upsert({
      where: { slug: data.slug },
      create: {
        ...data,
        categoryId: category.id,
        price: data.price * 100,
        oldPrice: data.oldPrice ? data.oldPrice * 100 : null,
        searchText: buildProductSearchText(data.name, data.description, data.composition),
      },
      update: {},
    });
  }

  const productsToBackfill = await prisma.product.findMany({
    where: { searchText: '' },
    select: { id: true, name: true, description: true, composition: true },
  });
  await Promise.all(productsToBackfill.map((product) => prisma.product.update({
    where: { id: product.id },
    data: { searchText: buildProductSearchText(product.name, product.description, product.composition) },
  })));

  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error('ADMIN_EMAIL и ADMIN_PASSWORD (не менее 12 символов) обязательны для seed');
  }
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), name: 'Администратор' },
    update: {},
  });
  console.log(JSON.stringify({ level: 'info', message: 'Демо-каталог и администратор готовы' }));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
