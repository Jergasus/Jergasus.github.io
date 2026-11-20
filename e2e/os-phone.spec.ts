import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { PHONE_ICON_ORDER } from '@/os/apps';
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

test('phone home has no axe violations', async ({ page }) => {
  await visit(page, '/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
