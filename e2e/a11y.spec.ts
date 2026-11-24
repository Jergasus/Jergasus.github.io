import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { apps, isCaseApp, PHONE_ICON_ORDER, type AppId } from '@/os/apps';
import { expect, test, visit, win, openFromStart } from './fixtures';
import { WELCOME_DELAY_MS } from '@/os/shell/toast-timing';
import { ALL_PAGES } from './pages';

// Quality gate (spec §5, WCAG 2.2 AA): axe finds no violation on any page,
// in each form the site takes (the desktop, the phone and the document a
// visitor without JavaScript reads), by day and by night. Reduced motion, so
// nothing is mid-animation when axe looks.
test.use({ reducedMotion: 'reduce' });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Runs axe, optionally on one part of the page; one line per failing node.
 *
 * Target size (2.5.8) is checked on the window in front, the taskbar and
 * everything else, but not on the windows behind it: those are stacked under
 * the front window on purpose, like any desktop, so their buttons are partly
 * covered wherever the windows overlap. Every one of those buttons is 24 px
 * or more when its window comes to the front (a click anywhere on it, its
 * taskbar button, or Tab), and every other rule still runs on them.
 */
async function axeReport(page: Page, include?: string): Promise<string[]> {
  await page.evaluate(() => document.fonts.ready);
  const run = async (configure: (builder: AxeBuilder) => AxeBuilder) => {
    let builder = configure(new AxeBuilder({ page }));
    if (include) builder = builder.include(include);
    const { violations } = await builder.analyze();
    return violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`),
    );
  };
  return [
    ...(await run((builder) => builder.withTags(TAGS).disableRules(['target-size']))),
    ...(await run((builder) => builder.withRules(['target-size']).exclude('[data-app][data-focused="false"]'))),
  ];
}

const MODES = {
  desktop: {},
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  document: {},
} as const;

/**
 * The document a visitor without JavaScript reads: the same HTML with every
 * script taken out. (axe runs in the page, so the page itself keeps
 * JavaScript; nothing of the site's runs, the pre-paint script included.)
 */
async function visitDocument(page: Page, path: string) {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    await route.fulfill({ response, body });
  });
  const response = await page.goto(path);
  await expect(page.locator('html')).not.toHaveAttribute('data-os');
  return response;
}

const THEMES = ['light', 'dark'] as const;

for (const [mode, options] of Object.entries(MODES)) {
  for (const colorScheme of THEMES) {
    test.describe(`${mode}, ${colorScheme}`, () => {
      test.use({ ...options, colorScheme });

      for (const path of ALL_PAGES) {
        test(`no axe violations (${path})`, async ({ page }) => {
          const response = mode === 'document' ? await visitDocument(page, path) : await visit(page, path);
          expect(response!.status()).toBe(200);
          if (mode !== 'document') {
            await expect(page.locator('html')).toHaveAttribute('data-os', mode);
          }
          expect(await axeReport(page)).toEqual([]);
        });
      }
    });
  }
}

// Every app window, opened the way a visitor opens it, scanned on its own:
// the windows that are closed on load (terminal, wizard, browser, settings…)
// are not in the page scans above.
const DESKTOP_APPS = apps.map((app) => app.id).filter((id) => !isCaseApp(id));
const PHONE_APPS = PHONE_ICON_ORDER.filter((id) => !isCaseApp(id));

for (const colorScheme of THEMES) {
  test.describe(`every desktop app, ${colorScheme}`, () => {
    test.use({ colorScheme, viewport: { width: 1440, height: 900 } });

    for (const id of DESKTOP_APPS) {
      test(`no axe violations in the ${id} window`, async ({ page }) => {
        await visit(page, '/');
        await openFromStart(page, id);
        expect(await axeReport(page, `[data-app="${id}"]`)).toEqual([]);
      });
    }
  });

  test.describe(`every phone app, ${colorScheme}`, () => {
    test.use({ ...MODES.phone, colorScheme });

    for (const id of PHONE_APPS) {
      test(`no axe violations in the ${id} app`, async ({ page }) => {
        await visit(page, '/');
        await page.locator(`[data-phone-icon="${id}"]`).tap();
        await expect(win(page, id)).toHaveAttribute('data-phone-active', 'true');
        expect(await axeReport(page, `[data-app="${id}"]`)).toEqual([]);
      });
    }

    // projects is not in PHONE_ICON_ORDER but opens from the guide button
    test('no axe violations in the projects app', async ({ page }) => {
      await visit(page, '/');
      await page.locator('[data-phone-home] button[data-open-app="projects"]').tap();
      await expect(win(page, 'projects')).toHaveAttribute('data-phone-active', 'true');
      expect(await axeReport(page, '[data-app="projects"]')).toEqual([]);
    });
  });

  // A commit notification, on the desktop and on the phone.
  for (const mode of ['desktop', 'phone'] as const) {
    test.describe(`a toast, ${mode}, ${colorScheme}`, () => {
      test.use({ ...MODES[mode], colorScheme });

      test('no axe violations in a commit notification', async ({ page }) => {
        // Close to the snapshot, so at least one commit is fresh.
        await page.clock.install({ time: new Date('2026-11-19T23:30:00Z') });
        await visit(page, '/');
        // Welcome is open at '/', so the toast waits 8 s.
        await page.clock.fastForward(WELCOME_DELAY_MS + 500);
        await expect(page.locator('[data-toast]').first()).toBeVisible();
        expect(await axeReport(page, '[data-toasts]')).toEqual([]);
      });
    });
  }
}
