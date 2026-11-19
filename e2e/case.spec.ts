import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { projects } from '@/content/projects';

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
  nav: { siteLabel: string; work: string };
  casePage: Record<'problem' | 'built' | 'decisions' | 'stack' | 'moreWork' | 'allWork', string>;
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
];
const VISIT = /visit|visita|visitar/i;

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

test('three case pages in three locales', async ({ page }) => {
  for (const { locale, prefix } of LOCALES) {
    for (const { slug, name } of CASES) {
      const url = `${prefix}/work/${slug}/`;
      const response = await page.goto(url);
      expect(response!.status(), url).toBe(200);
      await expect(page.locator('html'), url).toHaveAttribute('lang', locale);
      await expect(h1(page), url).toHaveText(name);
    }
  }
});

test('yokaido has no page', async ({ page }) => {
  const response = await page.goto('/work/yokaido/');
  expect(response!.status()).toBe(404);
});

test('live links', async ({ page }) => {
  for (const { url, href } of [
    { url: '/work/questday/', href: 'https://playquestday.com' },
    { url: '/en/work/sakurai/', href: 'https://www.getsakurai.com' },
  ]) {
    await page.goto(url);
    const visit = page.getByRole('link', { name: VISIT });
    await expect(visit).toHaveAttribute('href', href);
    await expect(visit).toHaveAttribute('target', '_blank');
    await expect(visit).toHaveAttribute('rel', /noopener/);
  }

  // No public URL yet, so no "visit" link in any language.
  for (const { prefix } of LOCALES) {
    await page.goto(`${prefix}/work/rally-voley/`);
    await expect(h1(page)).toHaveText('Rally Voley');
    await expect(page.getByRole('link', { name: VISIT })).toHaveCount(0);
  }
});

test('case page shows problem, build, decisions and stack', async ({ page }) => {
  await page.goto('/work/questday/');
  const copy = es.caseStudies.questday;
  const article = page.getByRole('article');

  await expect(article.getByRole('heading', { level: 2 })).toHaveText([
    es.casePage.problem,
    es.casePage.built,
    es.casePage.decisions,
    es.casePage.stack,
  ]);
  await expect(article.getByText(copy.summary)).toBeVisible();
  await expect(article.getByText(copy.problem)).toBeVisible();
  await expect(article.getByText(copy.built)).toBeVisible();
  await expect(article.getByRole('heading', { level: 3 })).toHaveText(
    copy.decisions.map((decision) => decision.title),
  );
  await expect(article.getByText(copy.stackNote)).toBeVisible();

  const stack = article.getByRole('list', { name: es.casePage.stack });
  await expect(stack.getByRole('listitem')).toHaveText(
    projects.find((p) => p.slug === 'questday')!.stack,
  );

  // The hero preview is the project's own screenshot, with a real description.
  const image = article.getByRole('img');
  await expect(image).toHaveAttribute('src', '/previews/questday.webp');
  await expect(image).toHaveAttribute('alt', /QuestDay/);
});

test('next and previous projects wrap around in the same locale', async ({ page }) => {
  await page.goto('/en/work/questday/');
  const nav = page.getByRole('navigation', { name: en.casePage.moreWork });
  await expect(nav.getByRole('link', { name: /SakurAI/ })).toHaveAttribute('href', '/en/work/sakurai/');
  await expect(nav.getByRole('link', { name: /Rally Voley/ })).toHaveAttribute(
    'href',
    '/en/work/rally-voley/',
  );
  await expect(nav.getByRole('link', { name: en.casePage.allWork })).toHaveAttribute(
    'href',
    '/en/#work',
  );

  await nav.getByRole('link', { name: /SakurAI/ }).click();
  await expect(page).toHaveURL('/en/work/sakurai/');
  await expect(h1(page)).toHaveText('SakurAI');
});

test('header anchors lead back to the home sections', async ({ page }) => {
  await page.goto('/en/work/questday/');
  const nav = page.getByRole('navigation', { name: en.nav.siteLabel });
  for (const id of ['work', 'now', 'business', 'about', 'contact']) {
    await expect(nav.locator(`a[href="/en/#${id}"]`)).toHaveCount(1);
  }

  await nav.getByRole('link', { name: en.nav.work }).click();
  await expect(page).toHaveURL('/en/#work');
  await expect(page.locator('#work')).toBeInViewport();
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

// ── Page transition ───────────────────────────────────────────────────────
// Next 16 drives React's <ViewTransition> through document.startViewTransition.
// The recorder wraps it and, once the transition's animations exist, notes
// which view-transition pseudo-elements animate, for how long and what.

type Animated = { pseudo: string; duration: number; properties: string[] };
type Run = { settled: boolean; animations: Animated[] };
declare global {
  interface Window {
    __viewTransitions?: Run[];
    /** Whether the document was revealed through a cross-document view transition. */
    __revealedWithTransition?: boolean;
  }
}

function recordViewTransitions() {
  const runs: Run[] = [];
  window.__viewTransitions = runs;
  const start = Document.prototype.startViewTransition;
  if (typeof start !== 'function') return;
  const META = ['offset', 'computedOffset', 'easing', 'composite'];
  Document.prototype.startViewTransition = function (this: Document, options) {
    const transition = start.call(this, options);
    const run: Run = { settled: false, animations: [] };
    runs.push(run);
    transition.ready
      .then(() => {
        for (const animation of document.getAnimations()) {
          const effect = animation.effect as KeyframeEffect | null;
          if (!effect?.pseudoElement?.startsWith('::view-transition')) continue;
          const properties = new Set(effect.getKeyframes().flatMap((frame) => Object.keys(frame)));
          run.animations.push({
            pseudo: effect.pseudoElement,
            duration: Number(effect.getComputedTiming().duration),
            properties: [...properties].filter((p) => !META.includes(p)),
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        run.settled = true;
      });
    return transition;
  };
}

// Every transition the page started, once each has finished starting.
async function recordedRuns(page: Page) {
  await expect
    .poll(() => page.evaluate(() => (window.__viewTransitions ?? []).every((run) => run.settled)))
    .toBe(true);
  return page.evaluate(() => window.__viewTransitions ?? []);
}

async function openQuestdayFromIndex(page: Page) {
  await page.addInitScript(recordViewTransitions);
  await page.goto('/');
  await page.locator('#work').getByRole('link', { name: 'QuestDay' }).click();
  await expect(page).toHaveURL('/work/questday/');
  await expect(h1(page)).toHaveText('QuestDay');
}

// The animations that move something. React's zero-duration fix-ups are not motion.
const moving = (runs: Run[]) =>
  runs.flatMap((run) => run.animations).filter((animation) => animation.duration > 0);

test('a row opens its case page with a view transition', async ({ page }) => {
  await openQuestdayFromIndex(page);
  const runs = await recordedRuns(page);
  expect(runs).toHaveLength(1);

  const animations = moving(runs);
  // The case page comes in...
  expect(animations.some((animation) => animation.pseudo.startsWith('::view-transition-new('))).toBe(true);
  // ...using transform and opacity only.
  for (const animation of animations) {
    const others = animation.properties.filter((p) => !['opacity', 'transform'].includes(p));
    expect(others, animation.pseudo).toEqual([]);
  }
});

// Only case-open navigations animate (PageTransition maps everything else to
// 'none'). Going back and switching language swap the page at once: no
// cross-fade of the content, the root or the header.
test('going back swaps the page without a cross-fade', async ({ page }) => {
  await openQuestdayFromIndex(page);
  const opened = (await recordedRuns(page)).length;

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(h1(page)).toHaveText('Jesús García');
  const runs = await recordedRuns(page);
  expect(moving(runs.slice(opened))).toEqual([]);
});

test('switching language swaps the page without a cross-fade', async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener('pagereveal', (event) => {
      window.__revealedWithTransition = Boolean(
        (event as Event & { viewTransition?: unknown }).viewTransition,
      );
    });
  });
  await openQuestdayFromIndex(page);

  // The switcher is a plain link: a full load of the same page in English.
  await page.locator('a[hreflang="en"]').click();
  await expect(page).toHaveURL('/en/work/questday/');
  await expect(h1(page)).toHaveText('QuestDay');
  // No cross-document transition revealed it, and none ran inside it.
  await expect.poll(() => page.evaluate(() => window.__revealedWithTransition)).toBe(false);
  expect(moving(await recordedRuns(page))).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('a row opens its case page without motion', async ({ page }) => {
    await openQuestdayFromIndex(page);
    expect(moving(await recordedRuns(page))).toEqual([]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('case content is visible', async ({ page }) => {
    await page.goto('/work/sakurai/');
    const copy = es.caseStudies.sakurai;
    const article = page.getByRole('article');
    await expect(h1(page)).toBeVisible();
    await expect(article.getByText(copy.problem)).toBeVisible();
    await expect(article.getByText(copy.decisions[0].body)).toBeVisible();
    await expect(article).toHaveCSS('opacity', '1');
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
