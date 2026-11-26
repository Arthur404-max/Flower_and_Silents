import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'admin@cvetotishina.local';
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? 'CvetoTishinaDemo2026!';

test('каталог доступен, ищет и фильтрует товары', async ({ request }) => {
  const config = await request.get('/api/v1/config');
  expect(config.status()).toBe(200);
  expect((await config.json()).demoMode).toBe(true);
  expect(config.headers()['x-content-type-options']).toBe('nosniff');

  const categories = await request.get('/api/v1/categories');
  expect(categories.status()).toBe(200);
  expect((await categories.json()).length).toBeGreaterThanOrEqual(6);

  const products = await request.get('/api/v1/products?limit=24');
  expect(products.status()).toBe(200);
  const catalog = await products.json();
  expect(catalog.items.length).toBeGreaterThanOrEqual(8);
  expect(catalog.items[0].price).toBeGreaterThan(0);

  const search = await request.get('/api/v1/products?q=Нежное');
  expect(search.status()).toBe(200);
  expect((await search.json()).items.some((item: { name: string }) => item.name === 'Нежное утро')).toBe(true);

  const filtered = await request.get('/api/v1/products?category=peonies');
  expect(filtered.status()).toBe(200);
  expect((await filtered.json()).items.every((item: { category: { slug: string } }) => item.category.slug === 'peonies')).toBe(true);
});

test('заказ идемпотентен, оплачивается и защищён токеном', async ({ request }) => {
  const catalogResponse = await request.get('/api/v1/products?limit=24');
  const catalog = await catalogResponse.json();
  const product = catalog.items.find((item: { stock: number }) => item.stock >= 2);
  expect(product).toBeTruthy();

  const quote = await request.post('/api/v1/cart/quote', {
    data: { items: [{ productId: product.id, quantity: 1 }], deliveryType: 'DELIVERY' },
  });
  expect(quote.status()).toBe(200);
  const quoted = await quote.json();
  expect(quoted.subtotal).toBe(product.price);
  expect(quoted.deliveryFee).toBe(product.price >= 500_000 ? 0 : 290_000);

  const payload = {
    items: [{ productId: product.id, quantity: 1 }],
    customerName: 'Тестовый покупатель',
    phone: '+7 999 000-00-00',
    email: 'test@example.test',
    deliveryType: 'DELIVERY',
    address: 'Тестовая улица, 1',
    comment: 'Автоматический тест',
    utensils: false,
  };
  const key = `order-${randomUUID()}`;
  const createdResponse = await request.post('/api/v1/orders', { data: payload, headers: { 'Idempotency-Key': key } });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  expect(created.order.status).toBe('AWAITING_PAYMENT');
  expect(created.accessToken.length).toBeGreaterThan(20);

  const repeated = await request.post('/api/v1/orders', { data: payload, headers: { 'Idempotency-Key': key } });
  expect(repeated.status()).toBe(201);
  expect((await repeated.json()).order.number).toBe(created.order.number);

  const conflict = await request.post('/api/v1/orders', {
    data: { ...payload, customerName: 'Другое имя' },
    headers: { 'Idempotency-Key': key },
  });
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).requestId).toBeTruthy();

  const missingKey = await request.post('/api/v1/orders', { data: payload });
  expect(missingKey.status()).toBe(400);

  const productAfter = await request.get(`/api/v1/products/${product.slug}`);
  expect((await productAfter.json()).stock).toBe(product.stock - 1);

  const paymentKey = `payment-${randomUUID()}`;
  const paidResponse = await request.post(`/api/v1/orders/${created.order.number}/payments/demo`, {
    data: { token: created.accessToken },
    headers: { 'Idempotency-Key': paymentKey },
  });
  expect(paidResponse.status()).toBe(200);
  expect((await paidResponse.json()).order.status).toBe('NEW');

  const publicOrder = await request.get(`/api/v1/orders/${created.order.number}?token=${created.accessToken}`);
  expect(publicOrder.status()).toBe(200);
  expect((await publicOrder.json()).order.paymentStatus).toBe('PAID');

  const wrongToken = await request.get(`/api/v1/orders/${created.order.number}?token=${'x'.repeat(43)}`);
  expect(wrongToken.status()).toBe(404);

  const login = await request.post('/api/v1/admin/auth/login', { data: { email: adminEmail, password: adminPassword } });
  expect(login.status()).toBe(200);
  const session = await login.json();

  const orders = await request.get(`/api/v1/admin/orders?q=${created.order.number}`);
  expect(orders.status()).toBe(200);
  const adminOrder = (await orders.json()).items.find((item: { id: string }) => item.id === created.order.id);
  expect(adminOrder).toBeTruthy();

  const noCsrf = await request.patch(`/api/v1/admin/orders/${adminOrder.id}/status`, {
    data: { status: 'ASSEMBLING' },
    headers: { 'If-Match': String(adminOrder.version) },
  });
  expect(noCsrf.status()).toBe(403);

  const wrongVersion = await request.patch(`/api/v1/admin/orders/${adminOrder.id}/status`, {
    data: { status: 'ASSEMBLING' },
    headers: { 'If-Match': String(adminOrder.version + 1), 'X-CSRF-Token': session.csrfToken },
  });
  expect(wrongVersion.status()).toBe(409);

  const changed = await request.patch(`/api/v1/admin/orders/${adminOrder.id}/status`, {
    data: { status: 'ASSEMBLING', comment: 'Проверка автоматическим тестом' },
    headers: { 'If-Match': String(adminOrder.version), 'X-CSRF-Token': session.csrfToken },
  });
  expect(changed.status()).toBe(200);
  expect((await changed.json()).status).toBe('ASSEMBLING');
});

test('админка требует авторизацию и проверяет загружаемые файлы', async ({ request }) => {
  const unauthorized = await request.get('/api/v1/admin/products');
  expect(unauthorized.status()).toBe(401);

  const wrongPassword = await request.post('/api/v1/admin/auth/login', {
    data: { email: adminEmail, password: 'wrong-password' },
  });
  expect(wrongPassword.status()).toBe(401);

  const login = await request.post('/api/v1/admin/auth/login', { data: { email: adminEmail, password: adminPassword } });
  expect(login.status()).toBe(200);
  const session = await login.json();

  const me = await request.get('/api/v1/admin/auth/me');
  expect(me.status()).toBe(200);
  const meBody = await me.json();
  expect(meBody.user.email).toBe(adminEmail);

  const fakeImage = await request.post('/api/v1/admin/uploads', {
    multipart: {
      image: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not a real png') },
    },
    headers: { 'X-CSRF-Token': meBody.csrfToken },
  });
  expect(fakeImage.status()).toBe(400);
});

test('валидация не принимает пустую корзину и доставку без адреса', async ({ request }) => {
  const empty = await request.post('/api/v1/cart/quote', { data: { items: [] } });
  expect(empty.status()).toBe(400);

  const catalog = await (await request.get('/api/v1/products?limit=1')).json();
  const noAddress = await request.post('/api/v1/orders', {
    data: {
      items: [{ productId: catalog.items[0].id, quantity: 1 }],
      customerName: 'Тест',
      phone: '+7 999 000-00-00',
      deliveryType: 'DELIVERY',
    },
    headers: { 'Idempotency-Key': `invalid-${randomUUID()}` },
  });
  expect(noAddress.status()).toBe(400);
});
