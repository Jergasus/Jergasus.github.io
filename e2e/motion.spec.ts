import { test, expect, type Page } from '@playwright/test';

// The motion layer exposes window.__motionDebug in NEXT_PUBLIC_E2E builds only
// (ruling R4; the Playwright webServer builds with it):
// - properties(): every property GSAP has tweened so far, hidden states included;
// - played: the page-load sequences that have run, in order.
type MotionDebug = { properties: () => string[]; played: string[] };
type DebugWindow = Window & { __motionDebug?: MotionDebug };

// Transform and opacity only, plus the hover preview's discrete visibility
// flip (ruling R13).
const ANIMATABLE = [
  'transform',
  'opacity',
  'scale',
  'x',
  'y',
  'xPercent',
  'yPercent',
  'scaleX',
  'scaleY',
  'rotate',
  'visibility',
];

const HERO_LINES = 'h1 [data-hero-line]';
const ROWS = '[data-testid=work-row]';
const IDENTITY = ['none', 'matrix(1, 0, 0, 1, 0, 0)'];

// What the visitor sees of each element: its opacity times every ancestor's,
// and its own transform.
const looks = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      let opacity = 1;
      for (let node: Element | null = element; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      return { opacity, transform: getComputedStyle(element).transform };
    }),
  );

// Elements inside `selector` (itself included) the motion layer still holds
// back: not fully opaque, or moved.
const heldBack = (page: Page, selector: string) =>
  page.locator(selector).evaluate((root) => {
    const identity = ['none', 'matrix(1, 0, 0, 1, 0, 0)'];
    return [root, ...root.querySelectorAll('*')].filter((element) => {
      const style = getComputedStyle(element);
      return Number(style.opacity) < 1 || !identity.includes(style.transform);
    }).length;
  });

async function motionDebug(page: Page) {
  await expect
    .poll(() => page.evaluate(() => Boolean((window as DebugWindow).__motionDebug)), {
      message:
        'window.__motionDebug is missing: run e2e on a NEXT_PUBLIC_E2E=1 build (nothing else on :4173)',
    })
    .toBe(true);
}

const played = (page: Page) =>
  page.evaluate(() => [...((window as DebugWindow).__motionDebug?.played ?? [])]);

// HoverPreview marks the work index once React has hydrated the page.
const hydrated = (page: Page) =>
  expect(page.locator('#work [data-preview]')).toHaveCount(1);

// Names of the properties every running CSS animation, transition or WAAPI
// animation changes. React adds zero-duration fix-ups during view transitions
// (::view-transition size, the root's pointer-events): those are not motion.
const runningProperties = (page: Page) =>
  page.evaluate(() => {
    const META = ['offset', 'computedOffset', 'easing', 'composite'];
    return document.getAnimations().flatMap((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      if (!effect || Number(effect.getComputedTiming().duration) === 0) return [];
      return effect
        .getKeyframes()
        .flatMap((frame) => Object.keys(frame))
        .filter((key) => !META.includes(key));
    });
  });

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('content visible without JS', async ({ page }) => {
    await page.goto('/');
    const targets = page.locator('h1, h2, [data-testid=work-row]');
    // The name, five section headings and four rows: an empty page cannot pass.
    expect(await targets.count()).toBeGreaterThanOrEqual(10);
    for (const target of await targets.all()) {
      await target.scrollIntoViewIfNeeded();
      await expect(target).toHaveCSS('opacity', '1');
      await expect(target).toBeInViewport();
    }
    expect(await heldBack(page, 'main')).toBe(0);
  });
});

test.describe('reduced motion', () => {
  test('reduced motion shows final state', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const lines = await looks(page, HERO_LINES);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(IDENTITY).toContain(line.transform);

    // Still final once React has hydrated, and no sequence ran.
    await hydrated(page);
    await motionDebug(page);
    for (const element of [...(await looks(page, HERO_LINES)), ...(await looks(page, ROWS))]) {
      expect(IDENTITY).toContain(element.transform);
      expect(element.opacity).toBe(1);
    }
    expect(await played(page)).toEqual([]);
  });

  test('reduced motion never holds a section back', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await hydrated(page);
    await motionDebug(page);
    expect(await heldBack(page, 'main')).toBe(0);

    await page.goto('/work/questday/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('QuestDay');
    await motionDebug(page);
    expect(await heldBack(page, 'main')).toBe(0);
  });
});

// Printing (or saving as PDF) mid-sequence or before scrolling must not lose
// the sections that are still waiting for their reveal.
for (const path of ['/', '/work/questday/']) {
  test(`printing shows everything the motion layer holds back (${path})`, async ({ page }) => {
    await page.goto(path);
    await motionDebug(page);
    // Right after load the sequence and the unscrolled reveals hold content
    // back, so the print check below is not a vacuous pass.
    await expect.poll(() => heldBack(page, 'main')).toBeGreaterThan(0);
    await page.emulateMedia({ media: 'print' });
    expect(await heldBack(page, 'main')).toBe(0);
  });
}

test('load sequence completes', async ({ page }) => {
  await page.goto('/');
  await motionDebug(page);
  await expect.poll(() => played(page)).toEqual(['home']);

  // It starts from the hidden state (the rows come in last)...
  const rowsAtStart = await looks(page, ROWS);
  expect(rowsAtStart.some((row) => row.opacity < 1)).toBe(true);

  // ...and 2500 ms later the name and the index are fully in place.
  await page.waitForTimeout(2500);
  const lines = await looks(page, HERO_LINES);
  const rows = await looks(page, ROWS);
  expect(lines).toHaveLength(2);
  expect(rows).toHaveLength(4);
  for (const element of [...lines, ...rows]) {
    expect(element.opacity).toBe(1);
    expect(IDENTITY).toContain(element.transform);
  }
});

test('load sequence plays once per full page load', async ({ page }) => {
  await page.goto('/');
  await motionDebug(page);
  await expect.poll(() => played(page)).toEqual(['home']);

  // A client navigation into a case page: the view transition moves it, the
  // reveals stay out of its way.
  await page.locator('#work').getByRole('link', { name: 'QuestDay' }).click();
  await expect(page).toHaveURL('/work/questday/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('QuestDay');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await heldBack(page, '[data-case-hero]')).toBe(0);

  // Back home, the name is already in place: no second sequence.
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator('h1')).toHaveText('Jesús García');
  for (const line of await looks(page, HERO_LINES)) {
    expect(line.opacity).toBe(1);
    expect(IDENTITY).toContain(line.transform);
  }
  expect(await played(page)).toEqual(['home']);
});

test('a page that comes alive late keeps its first screen in place', async ({ page }) => {
  // The server HTML paints at once; the scripts arrive 600 ms later (a slow
  // connection). The name has been read by then: it must never be moved out.
  // Scripts only: the stylesheet lives in the same folder and blocks the paint.
  await page.route('**/_next/static/chunks/**/*.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.addInitScript(() => {
    const w = window as Window & { __lineMoved?: boolean };
    w.__lineMoved = false;
    const watch = () => {
      for (const line of document.querySelectorAll('[data-hero-line]')) {
        const { transform } = getComputedStyle(line);
        if (transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)') w.__lineMoved = true;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.goto('/');
  await hydrated(page);
  await motionDebug(page);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as Window & { __lineMoved?: boolean }).__lineMoved)).toBe(false);
  expect(await heldBack(page, 'h1')).toBe(0);
});

test('landing on /#work, the rows come in without waiting for the opening', async ({ page }) => {
  // The case pages' "all work" link and the header lead here.
  await page.goto('/#work');
  await motionDebug(page);
  await expect.poll(() => played(page)).toEqual(['home']);
  // The opening, off screen, is skipped...
  for (const line of await looks(page, HERO_LINES)) expect(IDENTITY).toContain(line.transform);
  // ...so the rows' stagger (under 0.7s) starts at once.
  await expect
    .poll(async () => (await looks(page, ROWS)).every((row) => row.opacity === 1), { timeout: 1200 })
    .toBe(true);
});

test('sections reveal once as they scroll into view', async ({ page }) => {
  await page.goto('/');
  await motionDebug(page);
  await expect.poll(() => played(page)).toEqual(['home']);

  // Below the fold, the contact section waits hidden (set up a frame after hydration)...
  await expect.poll(() => heldBack(page, '#contact')).toBeGreaterThan(0);

  // ...is fully shown once it has scrolled into view...
  await page.locator('#contact h2').scrollIntoViewIfNeeded();
  await expect.poll(() => heldBack(page, '#contact')).toBe(0);

  // ...and stays shown after scrolling away and back.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#contact h2').scrollIntoViewIfNeeded();
  expect(await heldBack(page, '#contact')).toBe(0);
});

test('a scroll reveal never moves the page', async ({ page }) => {
  // English at 375px: the business heading wraps, so it splits into lines.
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/en/');
  await motionDebug(page);
  await expect.poll(() => played(page)).toEqual(['home']);
  await page.evaluate(() => document.fonts.ready);
  const place = () =>
    page.evaluate(() => {
      const box = document.querySelector('#business h2')!.getBoundingClientRect();
      return { scrollY: window.scrollY, top: box.top + window.scrollY, height: box.height };
    });

  // Below the fold, the heading waits split into masked lines (the reveals
  // are set up a frame after hydration)...
  await expect.poll(() => page.locator('#business h2 .reveal-line').count()).toBeGreaterThan(1);
  const before = await place();

  // ...starts rising once it is brought to mid-screen...
  await page.evaluate(() => {
    const heading = document.querySelector('#business h2')!;
    window.scrollTo(0, heading.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2);
  });
  const during = await place();
  expect({ top: during.top, height: during.height }).toEqual({ top: before.top, height: before.height });

  // ...and lands with its own markup back, the heading and the scroll position unmoved.
  await expect.poll(() => heldBack(page, '#business')).toBe(0);
  await expect(page.locator('#business h2 .reveal-line')).toHaveCount(0);
  expect(await place()).toEqual(during);
});

test('a revealed heading never replays when the viewport changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await motionDebug(page);
  await expect.poll(() => played(page)).toEqual(['home']);

  // The About heading waits split (SplitText with autoSplit)...
  await expect.poll(() => page.locator('#about h2 .reveal-line').count()).toBeGreaterThan(0);
  // ...reveals, and lands with its own markup back.
  await page.locator('#about h2').scrollIntoViewIfNeeded();
  await expect.poll(() => heldBack(page, '#about')).toBe(0);
  await expect(page.locator('#about h2 .reveal-line')).toHaveCount(0);

  // From here, every frame: the heading must stay split-free, opaque and in place.
  await page.evaluate(() => {
    const w = window as Window & { __replayed?: boolean };
    w.__replayed = false;
    const heading = document.querySelector('#about h2')!;
    const identity = ['none', 'matrix(1, 0, 0, 1, 0, 0)'];
    const watch = () => {
      if (heading.querySelector('.reveal-line')) w.__replayed = true;
      for (const element of [heading, ...heading.querySelectorAll('*')]) {
        const style = getComputedStyle(element);
        if (Number(style.opacity) < 1 || !identity.includes(style.transform)) w.__replayed = true;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });

  // A width change is what autoSplit re-splits on; fonts are already loaded.
  for (const width of [1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(600);
  }
  await page.locator('#about h2').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as Window & { __replayed?: boolean }).__replayed)).toBe(false);
});

test('a page loaded mid-scroll leaves nothing hidden', async ({ page }) => {
  await page.goto('/#contact');
  await motionDebug(page);
  // Jump past every section without stopping on any.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => heldBack(page, 'main'), { timeout: 5000 }).toBe(0);
});

test('only transform/opacity animate', async ({ page }) => {
  const seen = new Set<string>();
  const sample = async () => {
    for (const property of await runningProperties(page)) seen.add(property);
  };

  await page.goto('/');
  await motionDebug(page);
  await expect.poll(() => played(page)).toEqual(['home']);
  await sample();

  // Every scroll reveal on the way down.
  for (const heading of await page.locator('main h2').all()) {
    await heading.scrollIntoViewIfNeeded();
    await sample();
  }

  // Hover states (the default Desktop Chrome pointer is fine and hovers).
  for (const target of [
    page.getByTestId('work-row').filter({ hasText: 'QuestDay' }),
    page.locator('[data-business-cta]'),
    page.locator('#contact a[href^="mailto:"]'),
    page.locator('#contact a[href*="github"]'),
    page.locator('footer a').first(),
  ]) {
    await target.hover();
    await sample();
  }

  // A case page and its hover states.
  await page.locator('#work').getByRole('link', { name: 'QuestDay' }).click();
  await expect(page).toHaveURL('/work/questday/');
  for (const target of [
    page.getByRole('link', { name: /visit|visita/i }),
    page.locator('[data-case-nav] a').first(),
    page.locator('[data-case-nav] a[href$="#work"]'),
  ]) {
    await target.hover();
    await sample();
  }

  // Everything GSAP tweened on the way, hidden states included.
  const tweened = await page.evaluate(() => (window as DebugWindow).__motionDebug!.properties());
  expect(tweened.length).toBeGreaterThan(0);
  for (const property of tweened) seen.add(property);

  expect([...seen].filter((property) => !ANIMATABLE.includes(property))).toEqual([]);
});
