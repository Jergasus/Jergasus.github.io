import { expect, test } from './fixtures';

test('/ is Spanish', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});

test('/en/ and /ca/ are prefixed', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/ca/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ca');
});

test('/es/ is not generated', async ({ page }) => {
  const response = await page.goto('/es/');
  expect(response!.status()).toBe(404);
});

test('switcher keeps page', async ({ page }) => {
  await page.goto('/');
  await page.locator('a[hreflang="en"]').click();
  await expect(page).toHaveURL('/en/');

  await page.goto('/work/questday/');
  await page.locator('a[hreflang="en"]').click();
  await expect(page).toHaveURL('/en/work/questday/');
});

test('switcher hrefs are path-aware on a case page', async ({ page }) => {
  await page.goto('/en/work/questday/');
  await expect(page.locator('a[hreflang="es"]')).toHaveAttribute('href', '/work/questday/');
  await expect(page.locator('a[hreflang="ca"]')).toHaveAttribute('href', '/ca/work/questday/');
  await expect(page.locator('a[hreflang="en"]')).toHaveAttribute('href', '/en/work/questday/');
});

test('switcher hrefs are path-aware on /en/', async ({ page }) => {
  await page.goto('/en/');
  const esHref = await page.locator('a[hreflang="es"]').getAttribute('href');
  const caHref = await page.locator('a[hreflang="ca"]').getAttribute('href');
  expect(esHref).toBe('/');
  expect(caHref).toBe('/ca/');
});

test('hreflang alternates', async ({ page, baseURL }) => {
  await page.goto('/');

  const getAlternate = (hreflang: string) =>
    page.evaluate(
      (lang) =>
        document
          .querySelector(`link[rel="alternate"][hreflang="${lang}"]`)
          ?.getAttribute('href') ?? null,
      hreflang,
    );

  const esHref = await getAlternate('es');
  const caHref = await getAlternate('ca');
  const enHref = await getAlternate('en');
  const xdefaultHref = await getAlternate('x-default');

  // Every page lists itself among its alternates (hreflang self-reference).
  expect(esHref).not.toBeNull();
  expect(caHref).not.toBeNull();
  expect(enHref).not.toBeNull();
  expect(xdefaultHref).not.toBeNull();

  expect(new URL(esHref!, baseURL!).pathname).toBe('/');
  expect(new URL(caHref!, baseURL!).pathname).toBe('/ca/');
  expect(new URL(enHref!, baseURL!).pathname).toBe('/en/');
  expect(new URL(xdefaultHref!, baseURL!).pathname).toBe('/');
});
