import type { Page } from '@playwright/test';
import { themeColor, themeColorDark } from '@/design/theme-color';
import { expect, test, visit } from './fixtures';
import { ALL_PAGES, HOME_PAGES } from './pages';

// Quality gate (spec §4 anti-goals, §5): nothing breaks at 375px, every
// control answers a press on a touch screen, and the OS works from the
// keyboard alone with a visible focus ring.

test.describe('375 x 812', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  // The phone: a case page shows its project full screen.
  for (const path of ALL_PAGES) {
    test(`no horizontal scroll (${path})`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response!.status()).toBe(200);
      // Measure with the real fonts.
      await page.evaluate(() => document.fonts.ready);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(375);
    });
  }

  // The document: every content window at once, the widest content there is.
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    for (const path of ALL_PAGES) {
      test(`no horizontal scroll in the document (${path})`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response!.status()).toBe(200);
        await page.evaluate(() => document.fonts.ready);
        const { scrollWidth, windows } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          windows: document.querySelectorAll('[data-app]').length,
        }));
        // Not a vacuous pass: the windows are there to measure.
        expect(windows).toBeGreaterThanOrEqual(7);
        expect(scrollWidth).toBeLessThanOrEqual(375);
      });
    }
  });
});

type Stop = {
  /** What the focused element is, for the assertions below. */
  kind: string;
  outlineStyle: string;
  outlineWidth: number;
  boxShadow: string;
};

// Presses Tab from the top of the page until focus leaves the document or
// comes back to an element it already visited, and records every stop.
async function tabThrough(page: Page, limit = 80): Promise<Stop[]> {
  const stops: Stop[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const app = element.closest('[data-app]')?.getAttribute('data-app');
      let kind = `other:${element.tagName.toLowerCase()}:${app ?? ''}`;
      if (element.closest('[data-taskbar]') && element.hasAttribute('hreflang')) {
        kind = `switcher:${element.getAttribute('hreflang')}`;
      } else if (element.matches('[data-win-close]')) {
        kind = `close:${app}`;
      } else if (element.matches('[data-win-minimize]')) {
        kind = `minimize:${app}`;
      } else if (element.matches('[data-win-maximize]')) {
        kind = `maximize:${app}`;
      } else if (element.matches('[data-open-app]')) {
        kind = `item:${element.getAttribute('data-open-app')}`;
      }
      const style = getComputedStyle(element);
      return {
        kind,
        id: `${kind}#${[...document.querySelectorAll('*')].indexOf(element)}`,
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        boxShadow: style.boxShadow,
      };
    });
    if (!stop || seen.has(stop.id)) break;
    seen.add(stop.id);
    stops.push(stop);
  }
  return stops;
}

const ringVisible = (stop: Stop) =>
  (stop.outlineStyle !== 'none' && stop.outlineWidth > 0) || stop.boxShadow !== 'none';

for (const path of HOME_PAGES) {
  test(`keyboard reaches every action with a visible focus ring (${path})`, async ({ page }) => {
    await visit(page, path);
    const stops = await tabThrough(page);
    const expected = [
      ...['about', 'projects'].flatMap((app) => [`minimize:${app}`, `maximize:${app}`, `close:${app}`]),
      'item:questday',
      'item:sakurai',
      'item:rally-voley',
      'item:yokaido',
      'switcher:es',
      'switcher:ca',
      'switcher:en',
    ];
    for (const kind of expected) {
      const stop = stops.find((candidate) => candidate.kind === kind);
      expect(stop, `Tab never reaches ${kind}`).toBeDefined();
      expect(ringVisible(stop!), `${kind} shows no focus ring`).toBe(true);
    }
  });
}

// Touch (mobile-native): hover styles never apply on a coarse pointer, so a
// press needs its own :active cue, and iOS Safari applies :active only when
// the page has a touch listener. A large touch screen still gets the desktop.
test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1280, height: 800 } });

  test('the page has a touch listener, so iOS shows press cues', async ({ page, context }) => {
    await visit(page, '/');
    const cdp = await context.newCDPSession(page);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'document' });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
      objectId: result.objectId!,
    });
    expect(listeners.map((listener) => listener.type)).toContain('touchstart');
  });

  // What a finger presses, and the property that answers.
  const PRESSES = [
    { name: 'close button', press: '[data-app="about"] [data-win-close]', property: 'background-color' },
    { name: 'minimise button', press: '[data-app="about"] [data-win-minimize]', property: 'background-color' },
    { name: 'maximise button', press: '[data-app="about"] [data-win-maximize]', property: 'background-color' },
    { name: 'project item', press: '[data-app="projects"] a[data-open-app]', property: 'background-color' },
    { name: 'yokaido item', press: '[data-app="projects"] button[data-open-app]', property: 'background-color' },
    { name: 'language switcher', press: '[data-taskbar] a[hreflang="en"]', property: 'background-color' },
  ];

  for (const { name, press, property } of PRESSES) {
    test(`pressing the ${name} shows a cue`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await visit(page, '/');
      // Measure with the real fonts: a late font swap moves things.
      await page.evaluate(() => document.fonts.ready);
      const target = page.locator(press).first();
      const look = () => target.evaluate((element, prop) => getComputedStyle(element).getPropertyValue(prop), property);
      const rest = await look();
      const box = (await target.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const pressed = await look();
      // Release away from the element: a press, not a click, so nothing opens.
      await page.mouse.move(1, 1);
      await page.mouse.up();
      expect(pressed, `${name} looks the same while pressed`).not.toBe(rest);
    });
  }
});

const rgb = (hex: string) => {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi)!.map((pair) => parseInt(pair, 16));
  return `rgb(${r}, ${g}, ${b})`;
};

test('the browser chrome takes the desk colour, by day and by night', async ({ page }) => {
  await page.goto('/');
  const metas = await page
    .locator('meta[name="theme-color"]')
    .evaluateAll((elements) =>
      elements.map((meta) => ({ media: meta.getAttribute('media'), color: meta.getAttribute('content') })),
    );
  expect(metas).toEqual([
    { media: '(prefers-color-scheme: light)', color: themeColor },
    { media: '(prefers-color-scheme: dark)', color: themeColorDark },
  ]);
  for (const [colorScheme, color] of [
    ['light', themeColor],
    ['dark', themeColorDark],
  ] as const) {
    await page.emulateMedia({ colorScheme });
    const desk = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(desk, colorScheme).toBe(rgb(color));
  }
});

// A tab with no icon reads as unfinished, and browsers that find no icon
// link ask for /favicon.ico anyway: a 404 there is a console error.
test('the site icon resolves', async ({ page, request }) => {
  await page.goto('/');
  const icons = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  expect(icons.length).toBeGreaterThanOrEqual(2);
  for (const href of [...icons, '/favicon.ico']) {
    expect((await request.get(href)).status(), href).toBe(200);
  }
});
