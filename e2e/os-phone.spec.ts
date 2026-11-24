import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { themeColorDark } from '@/design/theme-color';
import { PHONE_ICON_ORDER } from '@/os/apps';
import { expect, tapInView, test, visit } from './fixtures';
import { WELCOME_DELAY_MS } from '@/os/shell/toast-timing';

// Phone OS: 390 × 844, touch, mobile user-agent (iPhone 12 footprint).
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

/** Selector helpers */
const phoneHome = (page: Page) => page.locator('[data-phone-home]');
const phoneIcon = (page: Page, id: string) => page.locator(`[data-phone-icon="${id}"]`);
const dock = (page: Page) => page.locator('[data-dock]');
const phoneBack = (page: Page) => page.locator('[data-phone-active="true"] [data-phone-back]');
const phoneClose = (page: Page) => page.locator('[data-phone-active="true"] [data-win-close]');
const appWindow = (page: Page, id: string) => page.locator(`[data-app="${id}"]`);

test('tapping Contacto opens it full screen; back returns home', async ({ page }) => {
  await visit(page, '/');

  // Tap the contact icon
  await phoneIcon(page, 'contact').tap();

  // The contact window should be the active phone app
  const contactWin = appWindow(page, 'contact');
  await expect(contactWin).toHaveAttribute('data-phone-active', 'true');
  await expect(contactWin).toBeVisible();

  // The back button should be visible in the app's top bar
  await expect(phoneBack(page)).toBeVisible();

  // Tap back
  await phoneBack(page).tap();

  // We're back at home: contact window is no longer phoneActive
  await expect(contactWin).toHaveAttribute('data-phone-active', 'false');
  await expect(phoneHome(page)).toBeVisible();
});

test('tapping the QuestDay home icon navigates to /work/questday/ and shows its app', async ({ page }) => {
  await visit(page, '/');

  // Tap the QuestDay icon in the phone home grid
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

for (const [how, press] of [
  ['×', phoneClose],
  ['Back', phoneBack],
] as const) {
  test(`${how} on questday returns focus to its home icon`, async ({ page }) => {
    await visit(page, '/');
    await phoneIcon(page, 'questday').tap();
    await expect(appWindow(page, 'questday')).toHaveAttribute('data-phone-active', 'true');
    await expect(appWindow(page, 'questday')).toBeFocused();

    await press(page).tap();
    await expect(phoneHome(page)).toBeVisible();
    await expect(page).toHaveURL('/');
    await expect(phoneIcon(page, 'questday')).toBeFocused();
  });
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
  // Fixture already sets the boot skip flag so there is no boot screen.
  // Install a fake clock near the most recent commit so a toast fires.
  await page.clock.install({ time: FRESH_NOW });

  await visit(page, '/');

  // Advance past the 8 s welcome toast delay (welcome is open at '/').
  await page.clock.fastForward(WELCOME_DELAY_MS + 500);

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
  for (const control of [phoneIcon(page, 'contact'), dock(page).locator('a').first()]) {
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
  await phoneIcon(page, 'contact').tap();
  await expect(appWindow(page, 'contact')).toHaveAttribute('data-phone-active', 'true');
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
  await expect(appWindow(page, 'terminal')).toHaveAttribute('data-phone-active', 'true');
  const fontSize = (selector: string) =>
    page.locator(selector).evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(await fontSize('#os-terminal-input')).toBeGreaterThanOrEqual(16);
  await phoneBack(page).tap(); // → Home

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
  { name: 'home icon', open: null, press: '[data-phone-icon="contact"] .os-phone-icon-tile', property: 'translate' },
  { name: 'dock link', open: null, press: '[data-dock] a', property: 'opacity' },
  { name: 'Back', open: 'contact', press: '[data-phone-active="true"] [data-phone-back]', property: 'background-color' },
  { name: 'close', open: 'contact', press: '[data-phone-active="true"] [data-win-close]', property: 'background-color' },
  { name: 'wizard option', open: 'business', press: '[data-app="business"] .os-wizard-radio-label', property: 'background-color' },
  { name: 'guide button', open: null, press: '[data-phone-home] [data-welcome-part="actions"] button[data-open-app="projects"]', property: 'background-color' },
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
    // Ensure the element is in the visible part of any scroll container before
    // reading its bounding box — required for welcome-card project links which sit
    // near the bottom of the scroll area when 12 phone icons are present.
    await target.scrollIntoViewIfNeeded();
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

  // Open a non-case app (Sobre mí) on the phone, via its icon.
  await phoneIcon(page, 'about').tap();
  await expect(appWindow(page, 'about')).toHaveAttribute('data-phone-active', 'true');

  // The app heading (AboutApp renders an h2 with the author's name) must be
  // reachable by screen readers — confirms [data-windows] is not aria-hidden.
  await expect(appWindow(page, 'about').getByRole('heading', { level: 2 })).toBeVisible();

  // No axe violations while the app is open.
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// ── Guide card leads the home ─────────────────────────────────────────────

// The phone home shows the guide card first, then every app icon and the dock.
test('home shows the welcome first, then every app icon in order, and the dock', async ({ page }) => {
  await visit(page, '/');

  // Welcome card is in the phone home — guide variant
  const welcomeCard = phoneHome(page).locator('[data-welcome]');
  await expect(welcomeCard).toBeVisible();
  // Guide card: lede + question
  await expect(welcomeCard).toContainText('Desarrollador full-stack en Barcelona.');
  await expect(welcomeCard).toContainText('¿Por dónde empiezas?');
  // Three action buttons, no action links
  await expect(welcomeCard.locator('button[data-open-app]')).toHaveCount(3);
  await expect(welcomeCard.locator('a[data-open-app]')).toHaveCount(0);
  await expect(welcomeCard.locator('[data-shell="phone"]')).toHaveText('O explora las apps de abajo ↓');

  // Phone-only invitation paragraph is visible; desktop one is hidden
  await expect(welcomeCard.locator('[data-shell="phone"]')).toBeVisible();
  await expect(welcomeCard.locator('[data-shell="desktop"]')).toBeHidden();

  // No old widgets
  await expect(page.locator('[data-widget]')).toHaveCount(0);

  // Dock has exactly 2 links (email + whatsapp)
  await expect(dock(page).locator('a')).toHaveCount(2);
});

test('Ver proyectos opens Proyectos; Yokaido inside it comes Back to Proyectos, then home', async ({ page }) => {
  await visit(page, '/');

  // Tap the "Ver proyectos" guide button
  await phoneHome(page).locator('button[data-open-app="projects"]').tap();
  await expect(appWindow(page, 'projects')).toHaveAttribute('data-phone-active', 'true');

  // Open Yokaido from inside Proyectos
  await appWindow(page, 'projects').locator('button[data-open-app="yokaido"]').tap();
  await expect(appWindow(page, 'yokaido')).toHaveAttribute('data-phone-active', 'true');

  // Back reads "‹ Proyectos"
  await expect(phoneBack(page)).toContainText('Proyectos');
  await phoneBack(page).tap();
  await expect(appWindow(page, 'projects')).toHaveAttribute('data-phone-active', 'true');
  await expect(appWindow(page, 'projects').locator('button[data-open-app="yokaido"]')).toBeFocused();

  // Back reads "‹ Inicio"
  await expect(phoneBack(page)).toHaveText('‹ Inicio');
  await phoneBack(page).tap();
  await expect(phoneHome(page)).toBeVisible();
  await expect(phoneHome(page).locator('button[data-open-app="projects"]')).toBeFocused();
});

test('the phone welcome is the desktop welcome: same markup, same order', async ({ page }) => {
  await visit(page, '/');
  const phoneWelcome = phoneHome(page).locator('[data-welcome]');
  const desktopWelcome = appWindow(page, 'welcome').locator('[data-welcome]');
  const phoneHTML = await phoneWelcome.evaluate((el) => el.innerHTML);
  const desktopHTML = await desktopWelcome.evaluate((el) => el.innerHTML);
  expect(phoneHTML).toBe(desktopHTML);
});

test('home: the welcome card, then every app icon, in one scroll; the dock stays put', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await visit(page, '/');
  const scroll = page.locator('.os-phone-scroll');

  // The icon grid is a direct child of the scroll area, right after the welcome card.
  await expect(page.locator('.os-phone-scroll > .os-phone-welcome + .os-phone-icon-grid')).toHaveCount(1);

  // Every icon in PHONE_ICON_ORDER appears inside the scroll container.
  expect(
    await scroll.locator('[data-phone-icon]').evaluateAll((els) => els.map((el) => el.getAttribute('data-phone-icon'))),
  ).toEqual([...PHONE_ICON_ORDER]);

  const dockBox = (await dock(page).boundingBox())!;
  const gridTop = (await page.locator('.os-phone-icon-grid').boundingBox())!.y;

  // Scroll to the bottom of the scroll area instantly.
  await scroll.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
  // Poll until the scroll settles.
  await expect.poll(async () => {
    const { scrollTop, scrollHeight, clientHeight } = await scroll.evaluate((el) => ({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    return scrollTop + clientHeight >= scrollHeight - 2;
  }, { timeout: 3000 }).toBe(true);

  const scrolled = await scroll.evaluate((el) => el.scrollTop);
  expect(scrolled).toBeGreaterThan(0);

  // The grid moved up with the scroll.
  expect((await page.locator('.os-phone-icon-grid').boundingBox())!.y).toBeCloseTo(gridTop - scrolled, 0);

  // The last icon is fully above the dock.
  const last = (await phoneIcon(page, PHONE_ICON_ORDER.at(-1)!).boundingBox())!;
  expect(last.y + last.height).toBeLessThanOrEqual(dockBox.y);

  // The dock did not move (it is pinned outside the scroll container).
  expect(await dock(page).boundingBox()).toEqual(dockBox);

  // No horizontal scroll.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

for (const viewport of [
  { width: 360, height: 640 },
  { width: 375, height: 667 },
]) {
  for (const path of ['/', '/ca/', '/en/']) {
    test(`one-word phone icon labels stay on one line (${path}, ${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await visit(page, path);
      const broken = await page.locator('.os-phone-icon-label').evaluateAll((labels) =>
        labels
          .filter((label) => !label.textContent!.trim().includes(' '))
          .filter(
            (label) =>
              label.getBoundingClientRect().height > 1.6 * parseFloat(getComputedStyle(label).lineHeight) ||
              label.scrollWidth > label.clientWidth + 1,
          )
          .map((label) => label.textContent!.trim()),
      );
      expect(broken).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    });
  }
}

test('Back from Contacto opened in Nuevo proyecto returns there, then home', async ({ page }) => {
  await visit(page, '/');
  await phoneIcon(page, 'business').tap();
  const cta = appWindow(page, 'business').locator('button[data-open-app="contact"]');
  await cta.tap();
  await expect(appWindow(page, 'contact')).toHaveAttribute('data-phone-active', 'true');
  await expect(phoneBack(page)).toHaveText('‹ Nuevo proyecto');
  await phoneBack(page).tap();
  await expect(appWindow(page, 'business')).toHaveAttribute('data-phone-active', 'true');
  await expect(cta).toBeFocused();
  await expect(phoneBack(page)).toHaveText('‹ Inicio');
  await phoneBack(page).tap();
  await expect(phoneHome(page)).toBeVisible();
  await expect(phoneIcon(page, 'business')).toBeFocused();
});

test('× on Contacto opened from Nuevo proyecto goes home with focus on the Contacto icon', async ({ page }) => {
  await visit(page, '/');
  await phoneIcon(page, 'business').tap();
  const cta = appWindow(page, 'business').locator('button[data-open-app="contact"]');
  await cta.tap();
  await expect(appWindow(page, 'contact')).toHaveAttribute('data-phone-active', 'true');
  await phoneClose(page).tap();
  // Home screen visible; neither app is active; Contacto icon focused
  await expect(phoneHome(page)).toBeVisible();
  await expect(appWindow(page, 'contact')).not.toHaveAttribute('data-phone-active', 'true');
  await expect(phoneIcon(page, 'contact')).toBeFocused();
});

test('Actividad shows the 26-week grid', async ({ page }) => {
  await visit(page, '/');
  await phoneIcon(page, 'activity').tap();
  await expect(appWindow(page, 'activity')).toHaveAttribute('data-phone-active', 'true');

  const cells = page.locator('[data-app="activity"] [data-now-grid] [data-intensity]');
  await expect(cells).toHaveCount(26);
});

test('Back on a deep-linked project goes home and focuses its home icon', async ({ page }) => {
  await visit(page, '/work/sakurai/');
  await phoneBack(page).tap();
  await expect(page).toHaveURL('/');
  await expect(phoneIcon(page, 'sakurai')).toBeFocused();
});

// F1: welcome card body must have inner padding so text is not flush with the border.
test('phone welcome text sits ≥ 8 px inside the card border at 375×812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await visit(page, '/');

  const card = phoneHome(page).locator('.os-phone-welcome-body');
  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();

  // Left padding: first text node should be offset from card left edge
  const firstText = phoneHome(page).locator('[data-welcome-part="line"]').first();
  await expect(firstText).toBeVisible();
  const textBox = await firstText.boundingBox();
  expect(textBox).not.toBeNull();
  expect(textBox!.x - cardBox!.x).toBeGreaterThanOrEqual(8);

  // Bottom padding: scroll the welcome card to its end, then verify last visible text
  await card.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  // Poll until scroll settles
  await expect.poll(async () => {
    const el = await card.evaluate((e) => ({ scrollTop: e.scrollTop, scrollHeight: e.scrollHeight, clientHeight: e.clientHeight }));
    return el.scrollTop + el.clientHeight;
  }).toBeGreaterThanOrEqual(await card.evaluate((e) => e.scrollHeight - 2));

  const explorePhone = phoneHome(page).locator('[data-shell="phone"]');
  await expect(explorePhone).toBeVisible();
  const exploreBox = await explorePhone.boundingBox();
  expect(exploreBox).not.toBeNull();
  // The explore line should be at least 8 px above the card's bottom
  expect(cardBox!.y + cardBox!.height - (exploreBox!.y + exploreBox!.height)).toBeGreaterThanOrEqual(8);
});

// ---------------------------------------------------------------------------
// Phone welcome card: grey titlebar and border (TDD — matches desktop colour)
// ---------------------------------------------------------------------------

const GREY = 'rgb(92, 96, 105)';

test('phone welcome card titlebar background is grey', async ({ page }) => {
  await visit(page, '/');
  const titlebar = phoneHome(page).locator('.os-phone-welcome-titlebar');
  await expect(titlebar).toHaveCSS('background-color', GREY);
});

test('phone welcome card border is grey', async ({ page }) => {
  await visit(page, '/');
  const card = phoneHome(page).locator('.os-phone-welcome');
  await expect(card).toHaveCSS('border-top-color', GREY);
});

// ---------------------------------------------------------------------------
// Phone guide buttons: grey background with cream text, hover inverts (TDD)
// ---------------------------------------------------------------------------

const CREAM = 'rgb(237, 231, 217)';

for (const theme of [undefined, 'dark'] as const) {
  test(`phone guide button is grey with cream text in ${theme ?? 'light'} theme`, async ({ page }) => {
    await visit(page, '/');
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    }
    const btn = phoneHome(page).locator('[data-welcome-part="actions"] button[data-open-app="projects"]');
    await expect(btn).toHaveCSS('background-color', GREY);
    await expect(btn).toHaveCSS('color', CREAM);
  });
}

test('phone guide button tap opens the app', async ({ page }) => {
  await visit(page, '/');
  const btn = phoneHome(page).locator('[data-welcome-part="actions"] button[data-open-app="projects"]');
  await btn.tap();
  await expect(page.locator('[data-app="projects"]')).toHaveAttribute('data-phone-active', 'true');
});

// ---------------------------------------------------------------------------
// A11y: phone guide button focus ring must contrast ≥ 3:1 with the card bg.
// Before the fix, currentColor = cream = card bg → contrast 1:1 in light theme.
// After the fix, --os-ink contrasts ≥ 10:1 with the cream/dark card background.
// ---------------------------------------------------------------------------

for (const theme of [undefined, 'dark'] as const) {
  test(`phone guide button focus ring contrasts ≥ 3:1 with card bg at 375×812 (${theme ?? 'light'})`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await visit(page, '/');
    if (theme === 'dark') {
      await page.evaluate(() =>
        document.documentElement.setAttribute('data-theme', 'dark'),
      );
    }

    const btn = phoneHome(page).locator('[data-welcome-part="actions"] button[data-open-app="projects"]');
    await btn.focus();

    // Read outline-color via locator.evaluate() to preserve :focus-visible state.
    const outlineColor = await btn.evaluate(
      (el) => getComputedStyle(el).outlineColor,
    );
    const cardBg = await phoneHome(page)
      .locator('.os-phone-welcome')
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    const parse = (c: string) => c.match(/\d+(\.\d+)?/g)!.map(Number);
    const lum = ([r, g, b]: number[]) => {
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const [l1, l2] = [lum(parse(outlineColor)), lum(parse(cardBg))];
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    const ratio = (hi + 0.05) / (lo + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
}
