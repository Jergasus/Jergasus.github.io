import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { SITE_URL } from '@/content/site';

const HOME_PAGES = [
  { url: '/', locale: 'es' },
  { url: '/ca/', locale: 'ca' },
  { url: '/en/', locale: 'en' },
];

const CASE_SLUGS = ['questday', 'sakurai', 'rally-voley'] as const;
const LOCALES = [
  { prefix: '', locale: 'es' },
  { prefix: '/ca', locale: 'ca' },
  { prefix: '/en', locale: 'en' },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMeta(page: import('@playwright/test').Page, selector: string, attr: string) {
  return page.evaluate(
    ([s, a]) => document.querySelector(s)?.getAttribute(a) ?? '',
    [selector, attr] as const,
  );
}

// ── Home pages ────────────────────────────────────────────────────────────────

test('each home page has non-empty title, description, canonical and og:image', async ({
  page,
}) => {
  for (const { url } of HOME_PAGES) {
    await page.goto(url);

    const title = await page.title();
    const description = await getMeta(page, 'meta[name="description"]', 'content');
    const canonical = await getMeta(page, 'link[rel="canonical"]', 'href');
    const ogImage = await getMeta(page, 'meta[property="og:image"]', 'content');

    expect(title.length, `title on ${url}`).toBeGreaterThan(0);
    expect(description.length, `description on ${url}`).toBeGreaterThan(0);
    expect(canonical.length, `canonical on ${url}`).toBeGreaterThan(0);
    expect(ogImage.length, `og:image on ${url}`).toBeGreaterThan(0);
  }
});

test('home page titles and descriptions are unique across locales', async ({ page }) => {
  const titles: string[] = [];
  const descs: string[] = [];

  for (const { url } of HOME_PAGES) {
    await page.goto(url);
    titles.push(await page.title());
    descs.push(await getMeta(page, 'meta[name="description"]', 'content'));
  }

  const uniqueTitles = new Set(titles);
  const uniqueDescs = new Set(descs);
  expect(uniqueTitles.size, `titles must be unique: ${JSON.stringify(titles)}`).toBe(
    HOME_PAGES.length,
  );
  expect(uniqueDescs.size, `descriptions must be unique: ${JSON.stringify(descs)}`).toBe(
    HOME_PAGES.length,
  );
});

// ── Case pages ────────────────────────────────────────────────────────────────

test('each case page has non-empty title, description, canonical and og:image', async ({
  page,
}) => {
  for (const { prefix } of LOCALES) {
    for (const slug of CASE_SLUGS) {
      const url = `${prefix}/work/${slug}/`;
      await page.goto(url);

      const title = await page.title();
      const description = await getMeta(page, 'meta[name="description"]', 'content');
      const canonical = await getMeta(page, 'link[rel="canonical"]', 'href');
      const ogImage = await getMeta(page, 'meta[property="og:image"]', 'content');

      expect(title.length, `title on ${url}`).toBeGreaterThan(0);
      expect(description.length, `description on ${url}`).toBeGreaterThan(0);
      expect(canonical.length, `canonical on ${url}`).toBeGreaterThan(0);
      expect(ogImage.length, `og:image on ${url}`).toBeGreaterThan(0);
    }
  }
});

test('case page titles and descriptions are unique across all 9 pages', async ({ page }) => {
  const titles: string[] = [];
  const descs: string[] = [];

  for (const { prefix } of LOCALES) {
    for (const slug of CASE_SLUGS) {
      await page.goto(`${prefix}/work/${slug}/`);
      titles.push(await page.title());
      descs.push(await getMeta(page, 'meta[name="description"]', 'content'));
    }
  }

  const total = LOCALES.length * CASE_SLUGS.length; // 9

  const uniqueTitles = new Set(titles);
  expect(uniqueTitles.size, `titles must be unique: ${JSON.stringify(titles)}`).toBe(total);

  const uniqueDescs = new Set(descs);
  expect(uniqueDescs.size, `descriptions must be unique: ${JSON.stringify(descs)}`).toBe(total);
});

// ── sitemap.xml ───────────────────────────────────────────────────────────────

test('sitemap.xml lists all 12 URLs (3 homes + 9 case pages)', async ({ page }) => {
  const response = await page.goto('/sitemap.xml');
  expect(response!.status()).toBe(200);
  const content = await response!.text();

  // 3 home URLs
  expect(content).toContain(`${SITE_URL}/`);
  expect(content).toContain(`${SITE_URL}/ca/`);
  expect(content).toContain(`${SITE_URL}/en/`);

  // 9 case-page URLs (3 slugs × 3 locales)
  for (const slug of CASE_SLUGS) {
    expect(content).toContain(`${SITE_URL}/work/${slug}/`);
    expect(content).toContain(`${SITE_URL}/ca/work/${slug}/`);
    expect(content).toContain(`${SITE_URL}/en/work/${slug}/`);
  }

  // Exactly 12 <loc> entries
  const locs = content.match(/<loc>/g) ?? [];
  expect(locs.length, 'sitemap must have exactly 12 <loc> entries').toBe(12);
});

// ── robots.txt ────────────────────────────────────────────────────────────────

test('robots.txt allows all and references sitemap', async ({ page }) => {
  const response = await page.goto('/robots.txt');
  expect(response!.status()).toBe(200);
  const content = await response!.text();
  // Next.js serialises as "User-Agent" (title-case); robots.txt is case-insensitive.
  expect(content.toLowerCase()).toContain('user-agent: *');
  expect(content.toLowerCase()).toContain('allow: /');
  expect(content).toContain(`${SITE_URL}/sitemap.xml`);
});

// ── 404 ───────────────────────────────────────────────────────────────────────

test('out/404.html exists and contains Spanish text', () => {
  const filePath = join(process.cwd(), 'out', '404.html');
  expect(existsSync(filePath), 'out/404.html must exist after build').toBe(true);
  const content = readFileSync(filePath, 'utf8');
  // Must contain at least one Spanish indicator
  expect(content).toMatch(/p[áa]gina|no encontr|inicio|volver|404/i);
  // One document, not a page nested inside a default root layout.
  expect(content.match(/<html[\s>]/g) ?? []).toHaveLength(1);
  expect(content.match(/<body[\s>]/g) ?? []).toHaveLength(1);
  expect(content).toMatch(/<html[^>]*\slang="es"/);
});

// ── Open Graph ────────────────────────────────────────────────────────────────

async function openGraph(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const tags: Record<string, string[]> = {};
    for (const meta of document.querySelectorAll('meta[property^="og:"]')) {
      const property = meta.getAttribute('property')!;
      (tags[property] ??= []).push(meta.getAttribute('content') ?? '');
    }
    return tags;
  });
}

test('home pages carry url, type, locale and site name in Open Graph', async ({ page }) => {
  const expected = [
    { url: '/', locale: 'es_ES', alternates: ['ca_ES', 'en_GB'] },
    { url: '/en/', locale: 'en_GB', alternates: ['ca_ES', 'es_ES'] },
  ];
  for (const { url, locale, alternates } of expected) {
    await page.goto(url);
    const og = await openGraph(page);
    expect(og['og:url'], url).toEqual([`${SITE_URL}${url}`]);
    expect(og['og:type'], url).toEqual(['website']);
    expect(og['og:locale'], url).toEqual([locale]);
    expect([...(og['og:locale:alternate'] ?? [])].sort(), url).toEqual(alternates);
    expect(og['og:site_name'], url).toEqual(['Jesús García']);
  }
});

test('case pages are Open Graph articles at their own url', async ({ page }) => {
  await page.goto('/ca/work/sakurai/');
  const og = await openGraph(page);
  expect(og['og:url']).toEqual([`${SITE_URL}/ca/work/sakurai/`]);
  expect(og['og:type']).toEqual(['article']);
  expect(og['og:locale']).toEqual(['ca_ES']);
  expect([...(og['og:locale:alternate'] ?? [])].sort()).toEqual(['en_GB', 'es_ES']);
  expect(og['og:site_name']).toEqual(['Jesús García']);
  expect(og['og:image']).toEqual([`${SITE_URL}/og/ca.png`]);
});
