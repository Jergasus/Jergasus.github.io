import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { projects } from '@/content/projects';
import { expect, test, win } from './fixtures';

// Expected copy comes from the committed message files (read with fs, as in
// contact.spec.ts), so the assertions follow the copy instead of retyping it.
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

type CaseCopy = {
  title: string;
  summary: string;
  problem: string;
  built: string;
  decisions: { title: string; body: string }[];
  stackNote: string;
};
type Messages = {
  casePage: Record<'problem' | 'built' | 'decisions' | 'stack', string>;
  caseStudies: Record<'questday' | 'sakurai' | 'rallyVoley', CaseCopy>;
};
const es = readJson<Messages>('../messages/es.json');
const en = readJson<Messages>('../messages/en.json');

const LOCALES = [
  { locale: 'es', prefix: '' },
  { locale: 'ca', prefix: '/ca' },
  { locale: 'en', prefix: '/en' },
];
const CASES = [
  { slug: 'questday', name: 'QuestDay' },
  { slug: 'sakurai', name: 'SakurAI' },
  { slug: 'rally-voley', name: 'Rally Voley' },
] as const;
const VISIT = /visit|visita|visitar/i;

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

test('three case pages in three locales', async ({ page }) => {
  for (const { locale, prefix } of LOCALES) {
    for (const { slug, name } of CASES) {
      const url = `${prefix}/work/${slug}/`;
      const response = await page.goto(url);
      expect(response!.status(), url).toBe(200);
      await expect(page.locator('html'), url).toHaveAttribute('lang', locale);
      await expect(win(page, slug), url).toBeVisible();
      await expect(win(page, slug).getByRole('heading', { level: 1 }), url).toHaveText(name);
      await expect(h1(page), url).toHaveCount(1);
    }
  }
});

test('yokaido has no page', async ({ page }) => {
  const response = await page.goto('/work/yokaido/');
  expect(response!.status()).toBe(404);
});

test('live links', async ({ page }) => {
  for (const { url, slug, href } of [
    { url: '/work/questday/', slug: 'questday', href: 'https://playquestday.com' },
    { url: '/en/work/sakurai/', slug: 'sakurai', href: 'https://www.getsakurai.com' },
  ] as const) {
    await page.goto(url);
    const visit = win(page, slug).getByRole('link', { name: VISIT });
    await expect(visit).toHaveAttribute('href', href);
    await expect(visit).toHaveAttribute('target', '_blank');
    await expect(visit).toHaveAttribute('rel', /noopener/);
  }

  // No public URL yet, so no "visit" link in any language.
  for (const { prefix } of LOCALES) {
    await page.goto(`${prefix}/work/rally-voley/`);
    await expect(h1(page)).toHaveText('Rally Voley');
    await expect(win(page, 'rally-voley').getByRole('link', { name: VISIT })).toHaveCount(0);
  }
});

test('case window shows problem, build, decisions and stack', async ({ page }) => {
  await page.goto('/work/questday/');
  const copy = es.caseStudies.questday;
  const study = win(page, 'questday');

  await expect(study.getByRole('heading', { level: 2 })).toHaveText([
    es.casePage.problem,
    es.casePage.built,
    es.casePage.decisions,
    es.casePage.stack,
  ]);
  await expect(study.getByText(copy.summary)).toBeVisible();
  await expect(study.getByText(copy.problem)).toBeVisible();
  await expect(study.getByText(copy.built)).toBeVisible();
  await expect(study.getByRole('heading', { level: 3 })).toHaveText(
    copy.decisions.map((decision) => decision.title),
  );
  await expect(study.getByText(copy.stackNote)).toBeVisible();

  const stack = study.getByRole('list', { name: es.casePage.stack });
  await expect(stack.getByRole('listitem')).toHaveText(
    projects.find((p) => p.slug === 'questday')!.stack,
  );

  // The project's own screenshot, with a real description.
  const image = study.getByRole('img');
  await expect(image).toHaveAttribute('src', '/previews/questday.webp');
  await expect(image).toHaveAttribute('alt', /QuestDay/);
});

test('case pages carry their own title, canonical and alternates', async ({ page, baseURL }) => {
  await page.goto('/en/work/sakurai/');
  expect(await page.title()).toContain(en.caseStudies.sakurai.title);

  const href = (selector: string) =>
    page.evaluate((s) => document.querySelector(s)?.getAttribute('href') ?? null, selector);
  const pathOf = async (selector: string) => {
    const value = await href(selector);
    expect(value, selector).not.toBeNull();
    return new URL(value!, baseURL!).pathname;
  };

  expect(await pathOf('link[rel="canonical"]')).toBe('/en/work/sakurai/');
  expect(await pathOf('link[rel="alternate"][hreflang="es"]')).toBe('/work/sakurai/');
  expect(await pathOf('link[rel="alternate"][hreflang="ca"]')).toBe('/ca/work/sakurai/');
  expect(await pathOf('link[rel="alternate"][hreflang="en"]')).toBe('/en/work/sakurai/');
  expect(await pathOf('link[rel="alternate"][hreflang="x-default"]')).toBe('/work/sakurai/');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('case content is visible', async ({ page }) => {
    await page.goto('/work/sakurai/');
    const copy = es.caseStudies.sakurai;
    const study = win(page, 'sakurai');
    await expect(h1(page)).toBeVisible();
    await expect(study.getByText(copy.problem)).toBeVisible();
    await expect(study.getByText(copy.decisions[0].body)).toBeVisible();
    await expect(study).toHaveCSS('opacity', '1');
  });
});

// Copy is rendered on the server; only what client components translate is
// sent to the browser as messages. A page's HTML (RSC payload included) holds
// its own case study and none of the others.
test('a page ships no other case study copy', async ({ request }) => {
  const studies = [
    { slug: 'questday', copy: es.caseStudies.questday },
    { slug: 'sakurai', copy: es.caseStudies.sakurai },
    { slug: 'rally-voley', copy: es.caseStudies.rallyVoley },
  ];
  for (const { slug, copy } of studies) {
    const html = await (await request.get(`/work/${slug}/`)).text();
    expect(html, slug).toContain(copy.decisions[0].title);
    for (const other of studies.filter((study) => study.slug !== slug)) {
      expect(html, `${slug} carries ${other.slug}`).not.toContain(other.copy.decisions[0].title);
    }
  }
  const home = await (await request.get('/')).text();
  for (const { slug, copy } of studies) {
    expect(home, `home carries ${slug}`).not.toContain(copy.decisions[0].title);
  }
});
