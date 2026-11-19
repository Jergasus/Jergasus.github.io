import { test, expect, type Page } from '@playwright/test';

// Collects every request a page makes while it loads (preloads, fonts, chunks,
// prefetches) and returns the URLs that leave the site's own origin.
async function requestsOnLoad(page: Page, path: string) {
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  // A 404 page would pass vacuously; the real page must load.
  expect(response!.status()).toBe(200);
  return urls;
}

test.describe('no third-party requests on load', () => {
  for (const path of ['/', '/en/', '/work/questday/']) {
    test(path, async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const urls = await requestsOnLoad(page, path);
      expect(urls.filter((url) => new URL(url).origin !== origin)).toEqual([]);
    });
  }
});

test('fonts are self-hosted woff2', async ({ page, baseURL }) => {
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(request.url());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  // Display, text and mono faces.
  expect(fonts.length).toBeGreaterThanOrEqual(3);
  for (const url of fonts) {
    expect(new URL(url).origin).toBe(new URL(baseURL!).origin);
    expect(new URL(url).pathname).toMatch(/\.woff2$/);
  }
});
