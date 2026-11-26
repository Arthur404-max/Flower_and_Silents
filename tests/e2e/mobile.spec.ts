import { expect, test } from '@playwright/test';

test('мобильная витрина не переполняется и корзина доступна', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Цветы, после которых становится/ })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);

  await page.getByRole('button', { name: /Добавить .* в корзину/ }).first().click();
  const drawer = page.getByRole('dialog', { name: /Корзина/ });
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  const mobileCart = page.getByRole('button', { name: /Открыть корзину/ }).last();
  await expect(mobileCart).toBeVisible();
  await mobileCart.click();
  await expect(drawer).toBeVisible();
});
