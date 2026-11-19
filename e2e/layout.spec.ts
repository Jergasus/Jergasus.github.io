import { test, expect, type Page } from '@playwright/test';
import { contact } from '@/content/contact';
import { ALL_PAGES, HOME_PAGES } from './pages';

// Quality gate (spec §2 anti-goals, §6): nothing breaks at 375px, and the
// page works from the keyboard alone.

test.describe('375 x 812', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of ALL_PAGES) {
    test(`no horizontal scroll (${path})`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response!.status()).toBe(200);
      // Measure with the real fonts: the display face sets the widest lines.
      await page.evaluate(() => document.fonts.ready);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(375);
    });
  }
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
    const stop = await page.evaluate((whatsapp) => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const href = element.getAttribute('href') ?? '';
      let kind = `other:${element.tagName.toLowerCase()}:${href}`;
      if (element.closest('[data-site-header]') && element.hasAttribute('hreflang')) {
        kind = `switcher:${element.getAttribute('hreflang')}`;
      } else if (element.matches('a[data-testid=work-row]')) {
        kind = `row:${href}`;
      } else if (href.startsWith('mailto:')) {
        kind = 'email';
      } else if (href.startsWith(whatsapp)) {
        kind = 'whatsapp';
      }
      const style = getComputedStyle(element);
      return {
        kind,
        id: `${kind}#${[...document.querySelectorAll('*')].indexOf(element)}`,
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        boxShadow: style.boxShadow,
      };
    }, `https://wa.me/${contact.whatsappNumber}`);
    if (!stop || seen.has(stop.id)) break;
    seen.add(stop.id);
    stops.push(stop);
  }
  return stops;
}

const ringVisible = (stop: Stop) =>
  (stop.outlineStyle !== 'none' && stop.outlineWidth > 0) || stop.boxShadow !== 'none';

// Touch (mobile-native): hover styles never apply on a coarse pointer, so a
// tap needs its own :active cue, and iOS Safari applies :active only when the
// page has a touch listener.
test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  // Hydrated: the work index marks itself once React is running (HoverPreview).
  const hydrated = (page: Page) => expect(page.locator('#work [data-preview="off"]')).toHaveCount(1);

  test('the page has a touch listener, so iOS shows press cues', async ({ page, context }) => {
    await page.goto('/');
    await hydrated(page);
    const cdp = await context.newCDPSession(page);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'document' });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
      objectId: result.objectId!,
    });
    expect(listeners.map((listener) => listener.type)).toContain('touchstart');
  });

  // What a finger presses, the element whose look answers, and the property.
  const PRESSES = [
    { name: 'site name', press: '[data-site-header] a', probe: '', property: 'color' },
    { name: 'language switcher', press: 'a[hreflang="en"]', probe: '', property: 'color' },
    { name: 'work row', press: 'a[data-testid=work-row]', probe: 'h3', property: 'color' },
    { name: 'business call to action', press: '[data-business-cta]', probe: '', property: 'background-color' },
    { name: 'email', press: '#contact a[href^="mailto:"]', probe: '', property: 'color' },
    { name: 'whatsapp', press: '#contact a[href^="https://wa.me/"]', probe: '', property: 'color' },
    { name: 'linkedin', press: '#contact a[href*="linkedin"]', probe: '', property: 'color' },
    { name: 'footer link', press: 'footer a', probe: '', property: 'color' },
  ];

  for (const { name, press, probe, property } of PRESSES) {
    test(`pressing the ${name} shows a cue`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await hydrated(page);
      const target = page.locator(press).first();
      await target.scrollIntoViewIfNeeded();
      const look = () =>
        target.evaluate(
          (element, [selector, prop]) =>
            getComputedStyle(selector ? element.querySelector(selector)! : element).getPropertyValue(prop),
          [probe, property] as const,
        );
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

test('the browser chrome takes the paper colour', async ({ page }) => {
  await page.goto('/');
  const { meta, paper } = await page.evaluate(() => ({
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '',
    paper: getComputedStyle(document.documentElement).backgroundColor,
  }));
  const [r, g, b] = meta.match(/[0-9a-f]{2}/gi)!.map((hex) => parseInt(hex, 16));
  expect(paper).toBe(`rgb(${r}, ${g}, ${b})`);
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

for (const path of HOME_PAGES) {
  test(`keyboard reaches every action with a visible focus ring (${path})`, async ({ page }) => {
    await page.goto(path);
    // The rows' links come from the server HTML, so their hrefs are known
    // before any Tab: every one of them must be reached.
    const rowHrefs = await page
      .locator('a[data-testid=work-row]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(rowHrefs).toHaveLength(3);

    const stops = await tabThrough(page);
    const expected = [
      'switcher:es',
      'switcher:ca',
      'switcher:en',
      ...rowHrefs.map((href) => `row:${href}`),
      'email',
      'whatsapp',
    ];
    for (const kind of expected) {
      const stop = stops.find((candidate) => candidate.kind === kind);
      expect(stop, `Tab never reaches ${kind}`).toBeDefined();
      expect(ringVisible(stop!), `${kind} shows no focus ring`).toBe(true);
    }
  });
}
