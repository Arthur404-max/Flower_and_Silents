import { expect, test } from '@playwright/test';

const adminEmail = 'admin@cvetotishina.local';
const adminPassword = 'CvetoTishinaLocal2026!';
const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');

test('статическая витрина создаёт заказ и администратор меняет статус', async ({ page }) => {
  const customerName = `Покупатель ${Date.now()}`;
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url());
  });
  await page.goto(`${baseUrl}/#/`);
  await expect(page.getByRole('heading', { name: /Цветы, после которых становится/ })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(8);
  await expect.poll(() => page.locator('.product-card img').first().evaluate((image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  expect(await page.locator('body').innerText()).not.toMatch(/демо|demo/i);

  await page.getByRole('link', { name: /Выбрать букет/ }).first().click();
  await expect(page).toHaveURL(/#\/catalog/);
  const catalogSearch = page.locator('.catalog-search');
  await catalogSearch.getByRole('searchbox', { name: 'Поиск по каталогу' }).fill('Нежное');
  await catalogSearch.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);

  await page.getByRole('button', { name: /Добавить Нежное утро в корзину/ }).click();
  const drawer = page.getByRole('dialog', { name: /Корзина/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Нежное утро', { exact: true })).toBeVisible();
  await drawer.getByRole('link', { name: /Оформить заказ/ }).click();

  await expect(page.getByRole('heading', { name: /Оформление заказа/ })).toBeVisible();
  await page.getByRole('radio', { name: /Самовывоз/ }).check();
  await page.getByLabel(/Имя/).fill(customerName);
  await page.getByLabel(/Телефон/).fill('+7 999 123-45-67');
  await page.getByRole('button', { name: /Создать заказ/ }).click();

  await expect(page).toHaveURL(/#\/order\/CT-/);
  await expect(page.getByRole('heading', { name: 'Ваш заказ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Оплат/ }).click();
  await expect(page.getByText('Оплачено', { exact: true })).toBeVisible();
  await expect(page.getByText('Принят в работу', { exact: true }).first()).toBeVisible();

  await page.goto(`${baseUrl}/#/admin/login`);
  await page.getByLabel('Email').fill(adminEmail);
  await page.getByLabel('Пароль', { exact: true }).fill(adminPassword);
  await page.getByRole('button', { name: /Войти в панель/ }).click();
  await expect(page).toHaveURL(/#\/admin$/);

  await page.goto(`${baseUrl}/#/admin/orders?q=${encodeURIComponent(customerName)}`);
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Открыть заказ CT-/ }).click();
  await page.getByLabel('Новый статус').selectOption('ASSEMBLING');
  await page.getByLabel('Комментарий').fill('Передан флористу');
  await page.getByRole('button', { name: /Применить статус/ }).click();
  await expect(page.getByText('Собираем букет', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Передан флористу', { exact: true })).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test('статическая мобильная версия сохраняет корзину', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/#/`);
  await expect(page.getByRole('heading', { name: /Цветы, после которых становится/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  await page.getByRole('button', { name: /Добавить .* в корзину/ }).first().click();
  const drawer = page.getByRole('dialog', { name: /Корзина/ });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: /Открыть корзину/ }).last()).toBeVisible();
});
