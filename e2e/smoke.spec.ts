import { expect, test } from './fixtures';

test('home responds', async ({ page }) => {
  const response = await page.goto('/');
  expect(response!.status()).toBe(200);
});
