import { expect, test } from '@playwright/test';

test('покупатель проходит путь от каталога до демо-оплаты', async ({ page }) => {
  const customerName = `Браузерный покупатель ${Date.now()}`;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Цветы, после которых становится/ })).toBeVisible();
  await expect(page.getByText('Демонстрационный магазин', { exact: true })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(8);

  await page.getByRole('link', { name: /Выбрать букет/ }).first().click();
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByRole('heading', { name: /Найдите свой букет/ })).toBeVisible();

  const catalogSearch = page.locator('.catalog-search');
  await catalogSearch.getByRole('searchbox', { name: 'Поиск по каталогу' }).fill('Нежное');
  await catalogSearch.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Нежное утро', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Добавить Нежное утро в корзину/ }).click();
  const drawer = page.getByRole('dialog', { name: /Корзина/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Нежное утро', { exact: true })).toBeVisible();
  await drawer.getByRole('link', { name: /Оформить демо-заказ/ }).click();

  await expect(page.getByRole('heading', { name: /Оформление демо-заказа/ })).toBeVisible();
  await page.getByRole('radio', { name: /Самовывоз/ }).check();
  await page.getByLabel(/Имя/).fill(customerName);
  await page.getByLabel(/Телефон/).fill('+7 999 123-45-67');
  await page.getByLabel(/Email/).fill('browser@example.test');
  await page.getByRole('button', { name: /Создать демо-заказ/ }).click();

  await expect(page).toHaveURL(/\/order\/CT-/);
  await expect(page.getByRole('heading', { name: 'Ваш заказ', exact: true })).toBeVisible();
  await expect(page.getByText('Ожидает оплаты', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /Демо-оплата/ }).click();
  await expect(page.getByText('Оплачено демо', { exact: true })).toBeVisible();
  await expect(page.getByText('Принят в работу', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ваш заказ', exact: true })).toBeVisible();
  await expect(page.getByText('Оплачено демо', { exact: true })).toBeVisible();
});
