import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

const adminEmail = process.env.TEST_ADMIN_EMAIL ?? 'admin@cvetotishina.local';
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? 'CvetoTishinaDemo2026!';

test('администратор входит и меняет статус реального заказа', async ({ page, request }) => {
  const customerName = `Заказ из админки ${Date.now()}`;
  const catalog = await (await request.get('/api/v1/products?limit=1')).json();
  const createdResponse = await request.post('/api/v1/orders', {
    data: {
      items: [{ productId: catalog.items[0].id, quantity: 1 }],
      customerName,
      phone: '+7 999 765-43-21',
      deliveryType: 'PICKUP',
    },
    headers: { 'Idempotency-Key': `admin-${randomUUID()}` },
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();
  const paid = await request.post(`/api/v1/orders/${created.order.number}/payments/demo`, {
    data: { token: created.accessToken },
    headers: { 'Idempotency-Key': `admin-pay-${randomUUID()}` },
  });
  expect(paid.status()).toBe(200);

  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Пароль', { exact: true }).fill(adminPassword);
  await page.getByRole('button', { name: /Войти в панель/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: /Здравствуйте/ })).toBeVisible();

  await page.goto(`/admin/orders?q=${encodeURIComponent(customerName)}`);
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(`Открыть заказ ${created.order.number}`) }).click();
  await expect(page.getByRole('heading', { name: customerName, exact: true })).toBeVisible();
  await page.getByLabel('Новый статус').selectOption('ASSEMBLING');
  await page.getByLabel('Комментарий').fill('Букет передан флористу');
  await page.getByRole('button', { name: /Применить статус/ }).click();
  await expect(page.getByText('Собираем букет', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Букет передан флористу', { exact: true })).toBeVisible();
});
