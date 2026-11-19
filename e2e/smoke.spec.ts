import { test, expect } from '@playwright/test';

test('home responds', async ({ page }) => {
  const response = await page.goto('/');
  expect(response!.status()).toBe(200);
});
