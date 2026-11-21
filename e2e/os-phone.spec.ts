import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { PHONE_ICON_ORDER } from '@/os/apps';
import { themeColorDark } from '@/design/theme-color';
import { expect, test, visit } from './fixtures';

// Phone OS: 390 × 844, touch, mobile user-agent (iPhone 12 footprint).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

/** Selector helpers */
const phoneHome = (page: Page) => page.locator('[data-phone-home]');
const widget = (page: Page, name: 'hello' | 'activity') => page.locator(`[data-widget="${name}"]`);
const phoneIcon = (page: Page, id: string) => page.locator(`[data-phone-icon="${id}"]`);
const dock = (page: Page) => page.locator('[data-dock]');
const phoneBack = (page: Page) => page.locator('[data-phone-active="true"] [data-phone-back]');
const appWindow = (page: Page, id: string) => page.locator(`[data-app="${id}"]`);

test('home shows the hello and activity widgets, every icon and the dock', async ({ page }) => {
  await visit(page, '/');

  // Home screen is visible
  await expect(phoneHome(page)).toBeVisible();

  // Hello widget
  await expect(widget(page, 'hello')).toBeVisible();

  // Activity widget
  await expect(widget(page, 'activity')).toBeVisible();
  // 26-cell mini grid
  const cells = widget(page, 'activity').locator('[data-phone-grid] > span');
  await expect(cells).toHaveCount(26);

  // Every icon in PHONE_ICON_ORDER appears
  for (const id of PHONE_ICON_ORDER) {
    await expect(phoneIcon(page, id), `icon ${id}`).toBeVisible();
  }

  // Dock is present with two items
  await expect(dock(page)).toBeVisible();
  const dockItems = dock(page).locator('a');
  await expect(dockItems).toHaveCount(2);
});

test('tapping Sobre mí opens it full screen; back returns home', async ({ page }) => {
  await visit(page, '/');

  // Tap the about icon
  await phoneIcon(page, 'about').tap();

  // The about window should be the active phone app
  const aboutWin = appWindow(page, 'about');
  await expect(aboutWin).toHaveAttribute('data-phone-active', 'true');
  await expect(aboutWin).toBeVisible();

  // The home screen should not be in front (the app is covering it)
  // The back button should be visible in the app's top bar
  await expect(phoneBack(page)).toBeVisible();

  // Tap back
  await phoneBack(page).tap();

  // We're back at home: about window is no longer phoneActive
  await expect(aboutWin).toHaveAttribute('data-phone-active', 'false');
  await expect(phoneHome(page)).toBeVisible();
});

test('tapping QuestDay navigates to /work/questday/ and shows its app', async ({ page }) => {
  await visit(page, '/');

  // Tap the QuestDay icon
  await phoneIcon(page, 'questday').tap();

  // Should navigate to the case URL
  await expect(page).toHaveURL('/work/questday/');

  // The questday window is the active phone app, full screen
  const questdayWin = appWindow(page, 'questday');
  await expect(questdayWin).toHaveAttribute('data-phone-active', 'true');
  await expect(questdayWin).toBeVisible();

  // Back button is visible
  await expect(phoneBack(page)).toBeVisible();
});

// ── Focus back to the opener, and the visitor's last intent ──────────────

const phoneClose = (page: Page) => page.locator('[data-phone-active="true"] [data-win-close]');

for (const id of ['about', 'questday'] as const) {
  for (const [how, press] of [
    ['×', phoneClose],
    ['Back', phoneBack],
  ] as const) {
    test(`${how} on ${id} returns focus to the icon that opened it`, async ({ page }) => {
      await visit(page, '/');
      await phoneIcon(page, id).tap();
      await expect(appWindow(page, id)).toHaveAttribute('data-phone-active', 'true');
      await expect(appWindow(page, id)).toBeFocused();

      await press(page).tap();
      await expect(phoneHome(page)).toBeVisible();
      if (id === 'questday') await expect(page).toHaveURL('/');
      await expect(phoneIcon(page, id)).toBeFocused();
    });
  }
}

/** Watches whether the app is in front, every frame for `ms`: the values it went through, in order. */
const frontOver = (page: Page, id: string, ms: number) =>
  page.evaluate(
    ([app, duration]) =>
      new Promise<string[]>((resolve) => {
        const seen: string[] = [];
        const start = performance.now();
        const look = () => {
          const value = document.querySelector(`[data-app="${app}"]`)?.getAttribute('data-phone-active') ?? 'gone';
          if (seen.at(-1) !== value) seen.push(value);
          if (performance.now() - start < duration) requestAnimationFrame(look);
          else resolve(seen);
        };
        look();
      }),
    [id, ms] as const,
  );

test('Back then re-tap ends with the app open', async ({ page }) => {
  await visit(page, '/');
  await phoneIcon(page, 'questday').tap();
  await expect(page).toHaveURL('/work/questday/');
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');

  // Back, and straight back in without waiting for the URL.
  await phoneBack(page).tap();
  await phoneIcon(page, 'questday').tap();

  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');
  // It stays in front: nothing the Back started (its close, its trip home)
  // takes it away afterwards.
  expect(await frontOver(page, 'questday', 1000)).toEqual(['true']);
  await expect(page).toHaveURL('/work/questday/');
  await expect(appWindow(page, 'questday')).toBeVisible();
});

test('Back then re-tap ends with the app open, even while home is still loading', async ({ page }) => {
  // Reduced motion: Back moves the URL at once. Home's payload is held back,
  // so the re-tap lands while that navigation is still in flight.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let held = 0;
  let released = 0;
  await page.route(/^http:\/\/localhost:4173\/(index\.txt|__next\.[^/]*\.txt)/, async (route) => {
    held++;
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue().catch(() => undefined);
    released++;
  });
  await visit(page, '/work/questday/');
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');

  await phoneBack(page).tap();
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'false');
  await phoneIcon(page, 'questday').tap();

  // Home's payload was asked for (the race is real); once it has arrived and
  // had time to land, the last intent (the re-tap) still holds.
  await expect.poll(() => held).toBeGreaterThan(0);
  await expect.poll(() => released, { timeout: 10_000 }).toBe(held);
  expect((await frontOver(page, 'questday', 600)).at(-1)).toBe('true');
  await expect(page).toHaveURL('/work/questday/');
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');
  await expect(appWindow(page, 'questday')).toBeVisible();
});

// ── In-app Back and the browser's history (ruling R16) ───────────────────

/** Where the history stands: its length, and the URL of the entry before this one. */
const historyNow = (page: Page) =>
  page.evaluate(() => {
    const nav = (window as unknown as { navigation: { currentEntry: { index: number }; entries(): { url: string }[] } })
      .navigation;
    const before = nav.entries()[nav.currentEntry.index - 1];
    return { length: history.length, before: before ? new URL(before.url).pathname : null };
  });

test('Back on a project opened from home goes back: no new entry, so the system Back cannot reopen it', async ({ page }) => {
  await visit(page, '/');
  const { length } = await historyNow(page);
  await phoneIcon(page, 'questday').tap();
  await expect(page).toHaveURL('/work/questday/');
  expect((await historyNow(page)).length).toBe(length + 1);

  await phoneBack(page).tap();
  await expect(page).toHaveURL('/');
  await expect(phoneHome(page)).toBeVisible();
  await expect(appWindow(page, 'questday')).toHaveCount(0);
  // The history went back to home's own entry: nothing behind it is the project.
  expect(await historyNow(page)).toEqual({ length: length + 1, before: null });
});

test('Back on a project the visitor landed on goes home with a new entry', async ({ page }) => {
  await visit(page, '/work/questday/');
  const { length } = await historyNow(page);

  await phoneBack(page).tap();
  await expect(page).toHaveURL('/');
  await expect(phoneHome(page)).toBeVisible();
  await expect(appWindow(page, 'questday')).toHaveCount(0);
  expect(await historyNow(page)).toEqual({ length: length + 1, before: '/work/questday/' });
});

test('Back then re-tap while the history Back is still under way ends with the app open', async ({ page }) => {
  // Reduced motion: Back goes back at once. The browser's Back is held, so
  // the re-tap lands before it does (Next's router lets a Back that lands
  // later cancel a push made meanwhile).
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit(page, '/');
  await phoneIcon(page, 'questday').tap();
  await expect(page).toHaveURL('/work/questday/');
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');
  await page.evaluate(() => {
    const back = history.back.bind(history);
    const w = window as unknown as { heldBack: string };
    w.heldBack = 'none';
    history.back = () => {
      w.heldBack = 'held';
      window.setTimeout(() => {
        back();
        w.heldBack = 'done';
      }, 400);
    };
  });

  await phoneBack(page).tap();
  await phoneIcon(page, 'questday').tap();

  await expect.poll(() => page.evaluate(() => (window as unknown as { heldBack: string }).heldBack)).toBe('done');
  expect((await frontOver(page, 'questday', 600)).at(-1)).toBe('true');
  await expect(page).toHaveURL('/work/questday/');
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');
  await expect(appWindow(page, 'questday')).toBeVisible();
});

// ── What assistive tech and the keyboard reach (WCAG 2.4.11) ──────────────

test('with an app open, Tab never reaches the home screen under it', async ({ page }) => {
  await visit(page, '/');
  await phoneIcon(page, 'contact').tap();
  await expect(appWindow(page, 'contact')).toHaveAttribute('data-phone-active', 'true');

  let inApp = 0;
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let press = 1; press <= 20; press++) {
      await page.keyboard.press(key);
      const where = await page.evaluate(() => ({
        home: document.activeElement?.closest('[data-phone-home]') != null,
        app: document.activeElement?.closest('[data-app="contact"]') != null,
      }));
      expect(where.home, `${key} ${press}`).toBe(false);
      if (where.app) inApp++;
    }
  }
  // The walk did go through the app's own controls.
  expect(inApp).toBeGreaterThan(0);
  // Out of the accessibility tree as well, not only the Tab order.
  await expect(phoneHome(page)).toHaveAttribute('inert', '');

  // Home again: its controls are back.
  await phoneBack(page).tap();
  await expect(phoneHome(page)).not.toHaveAttribute('inert', /.*/);
  await expect(phoneIcon(page, 'contact')).toBeFocused();
});

test('the phone home keeps the page title in the accessibility tree', async ({ page }) => {
  await visit(page, '/');
  await expect(phoneHome(page)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveCount(1);
});

test('loading /work/sakurai/ on a phone shows the sakurai app', async ({ page }) => {
  await visit(page, '/work/sakurai/');

  // The sakurai window is immediately the active phone app
  const sakuraiWin = appWindow(page, 'sakurai');
  await expect(sakuraiWin).toHaveAttribute('data-phone-active', 'true');
  await expect(sakuraiWin).toBeVisible();
});

test('dock links are mailto: and https://wa.me/', async ({ page }) => {
  await visit(page, '/');

  const dockLinks = dock(page).locator('a');
  const hrefs = await dockLinks.evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));

  expect(hrefs.some((h) => h.startsWith('mailto:'))).toBe(true);
  expect(hrefs.some((h) => h.startsWith('https://wa.me/'))).toBe(true);
});

test('no horizontal scroll at 375 px on home and on every app', async ({ page }) => {
  // Test at 375 px width (the narrowest common phone)
  await page.setViewportSize({ width: 375, height: 812 });

  await visit(page, '/');

  // Home screen: no overflow
  const homeScroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(homeScroll, 'home horizontal scroll').toBeLessThanOrEqual(375);

  // A sample case app
  await visit(page, '/work/questday/');
  const caseScroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(caseScroll, 'questday horizontal scroll').toBeLessThanOrEqual(375);

  // A non-case app
  await visit(page, '/');
  await phoneIcon(page, 'about').tap();
  await expect(appWindow(page, 'about')).toHaveAttribute('data-phone-active', 'true');
  const aboutScroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(aboutScroll, 'about horizontal scroll').toBeLessThanOrEqual(375);
});

test('crossing the breakpoint keeps the active app', async ({ page }) => {
  // Start on a case page (phone)
  await visit(page, '/work/questday/');
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');

  // Cross to desktop (≥ 64rem = 1024 px)
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('html')).toHaveAttribute('data-os', 'desktop');

  // The questday window should still be open and focused on desktop
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-win-state', 'open');

  // Cross back to phone
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-os', 'phone');

  // The questday app should still be the active phone app
  await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');
});

// ── Toasts ───────────────────────────────────────────────────────────────────

// Clock anchor: within 14 days of the most recent commit (rally-voley 2026-11-19T20:50:52Z).
const FRESH_NOW = new Date('2026-11-20T00:00:00Z');

test('toasts do not overlap the phone dock', async ({ page }) => {
  // Fixture already sets jgos-booted=1 so there is no boot screen.
  // Install a fake clock near the most recent commit so a toast fires.
  await page.clock.install({ time: FRESH_NOW });

  await visit(page, '/');

  // Advance past the 1200 ms no-boot toast delay.
  await page.clock.fastForward(1500);

  // Wait for at least one toast to appear.
  const toast = page.locator('[data-toast]').first();
  await expect(toast).toBeVisible();

  // Compare bounding boxes: toast bottom must be above dock top.
  const toastBox = await toast.boundingBox();
  const dockBox = await dock(page).boundingBox();

  expect(toastBox).not.toBeNull();
  expect(dockBox).not.toBeNull();

  if (toastBox && dockBox) {
    // The bottom edge of the toast must be at or above the top edge of the dock.
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(dockBox.y);
  }
});

// ── Feels installed, not embedded (mobile-native, Task 14) ─────────────────
// What a desktop browser can check. Safe areas, sticky hover, the keyboard
// and rubber-banding need a real phone; the CSS for them is pinned here.

test('the viewport draws edge to edge, keeps pinch zoom and lets the keyboard resize the layout', async ({ page }) => {
  await visit(page, '/');
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('width=device-width');
  expect(content).toContain('viewport-fit=cover');
  expect(content).toContain('interactive-widget=resizes-content');
  expect(content).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
});

test('the phone shell has no tap flash and no pull-to-refresh behind it', async ({ page }) => {
  await visit(page, '/');
  const look = await page.evaluate(() => {
    const html = getComputedStyle(document.documentElement);
    return {
      tap: html.getPropertyValue('-webkit-tap-highlight-color'),
      overscroll: html.overscrollBehaviorY,
      body: getComputedStyle(document.body).overscrollBehaviorY,
    };
  });
  expect(look).toEqual({ tap: 'rgba(0, 0, 0, 0)', overscroll: 'none', body: 'none' });
});

test('home icons and the dock are controls: a long press selects no label', async ({ page }) => {
  await visit(page, '/');
  for (const control of [phoneIcon(page, 'about'), dock(page).locator('a').first()]) {
    const select = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.userSelect || style.webkitUserSelect;
    });
    expect(select).toBe('none');
  }
});

test('an app bar is thumb sized: Back on the left, close on the far right', async ({ page }) => {
  // Measured at rest, not while the app grows from its icon.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await visit(page, '/');
  await phoneIcon(page, 'about').tap();
  await expect(appWindow(page, 'about')).toHaveAttribute('data-phone-active', 'true');
  const back = (await phoneBack(page).boundingBox())!;
  const close = (await page.locator('[data-phone-active="true"] [data-win-close]').boundingBox())!;
  expect(back.x).toBeLessThanOrEqual(2);
  expect(back.height).toBeGreaterThanOrEqual(44);
  expect(close.width).toBeGreaterThanOrEqual(32);
  expect(close.height).toBeGreaterThanOrEqual(32);
  expect(390 - (close.x + close.width)).toBeLessThanOrEqual(8);
});

// iOS zooms into a field whose text is under 16 px, and never zooms back.
test('no text field zooms the page: the terminal and the wizard type at 16 px or more', async ({ page }) => {
  await visit(page, '/');
  await phoneIcon(page, 'terminal').tap();
  const fontSize = (selector: string) =>
    page.locator(selector).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(await fontSize('#os-terminal-input')).toBeGreaterThanOrEqual(16);
  await phoneBack(page).tap();

  await phoneIcon(page, 'business').tap();
  const wizard = appWindow(page, 'business');
  await wizard.locator('.os-wizard-radio-label').first().tap();
  await wizard.locator('.os-wizard-btn--primary').tap();
  await wizard.locator('.os-wizard-check-label').first().tap();
  await wizard.locator('.os-wizard-btn--primary').tap();
  for (const field of await wizard.locator('input[type="text"], textarea').all()) {
    expect(await field.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  }
  expect(await wizard.locator('input[type="text"], textarea').count()).toBeGreaterThan(0);
});

// A finger gets an answer the moment it lands (hover never fires on touch).
const PHONE_PRESSES = [
  { name: 'home icon', open: null, press: '[data-phone-icon="about"] .os-phone-icon-tile', property: 'translate' },
  { name: 'dock link', open: null, press: '[data-dock] a', property: 'opacity' },
  { name: 'Back', open: 'about', press: '[data-phone-active="true"] [data-phone-back]', property: 'background-color' },
  { name: 'close', open: 'about', press: '[data-phone-active="true"] [data-win-close]', property: 'background-color' },
  { name: 'wizard option', open: 'business', press: '[data-app="business"] .os-wizard-radio-label', property: 'background-color' },
] as const;

for (const { name, open, press, property } of PHONE_PRESSES) {
  test(`pressing a ${name} shows a cue at once`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await visit(page, '/');
    if (open) {
      await phoneIcon(page, open).tap();
      await expect(appWindow(page, open)).toHaveAttribute('data-phone-active', 'true');
    }
    const target = page.locator(press).first();
    const look = () => target.evaluate((element, prop) => getComputedStyle(element).getPropertyValue(prop), property);
    const rest = await look();
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const pressed = await look();
    // Release away from the control: a press, not a tap, so nothing opens.
    await page.mouse.move(1, 1);
    await page.mouse.up();
    expect(pressed, `${name} looks the same while pressed`).not.toBe(rest);
  });
}

// mobile-native §10: the status bar follows the theme the visitor chose,
// not only the system one.
test('a remembered night theme reaches the browser chrome', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('jgos-theme', 'dark');
    } catch {
      // The OS works without storage.
    }
  });
  await visit(page, '/');
  await expect
    .poll(() => page.locator('meta[name="theme-color"]').evaluateAll((metas) => metas.map((meta) => meta.getAttribute('content'))))
    .toEqual([themeColorDark, themeColorDark]);
});

test('phone home has no axe violations', async ({ page }) => {
  await visit(page, '/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('open app on phone has no axe violations and its heading is in the AT', async ({ page }) => {
  await visit(page, '/');

  // Open a non-case app (Sobre mí) on the phone.
  await phoneIcon(page, 'about').tap();
  await expect(appWindow(page, 'about')).toHaveAttribute('data-phone-active', 'true');

  // The app heading (AboutApp renders an h2 with the author's name) must be
  // reachable by screen readers — confirms [data-windows] is not aria-hidden.
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();

  // No axe violations while the app is open.
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
