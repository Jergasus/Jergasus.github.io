import type { Page } from '@playwright/test';
import { DESKTOP_ICON_ORDER } from '@/os/apps';
import { themeColor, themeColorDark } from '@/design/theme-color';
import { expect, test, visit, win, openFromIcon, taskbar } from './fixtures';

// ── Taskbar ───────────────────────────────────────────────────────────────

test('taskbar shows a button per open window and toggles minimise/restore', async ({ page }) => {
  await visit(page, '/');
  // about and projects are open by default
  await expect(taskbar(page).locator('[data-task="about"]')).toBeVisible();
  await expect(taskbar(page).locator('[data-task="projects"]')).toBeVisible();
  // clicking the focused window's button minimises it
  await win(page, 'projects').focus();
  await taskbar(page).locator('[data-task="projects"]').click();
  await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'minimized');
  // clicking again restores
  await taskbar(page).locator('[data-task="projects"]').click();
  await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'open');
});

// ── Start menu ────────────────────────────────────────────────────────────

test('start menu opens with Enter, lists apps, Escape closes and focus returns to start', async ({ page }) => {
  await visit(page, '/');
  const startBtn = page.locator('[data-start]');
  await startBtn.focus();
  await startBtn.press('Enter');
  const startMenu = page.locator('[data-start-menu]');
  await expect(startMenu).toBeVisible();
  await expect(startBtn).toHaveAttribute('aria-expanded', 'true');
  // Lists some apps
  await expect(startMenu).toContainText('QuestDay');
  await expect(startMenu).toContainText('Actividad');
  // Escape closes and focus returns
  await page.keyboard.press('Escape');
  await expect(startMenu).not.toBeVisible();
  await expect(startBtn).toBeFocused();
});

// Spec §9.1: the OS name is on the start button, which says it opens a menu.
for (const [path, name] of [
  ['/', 'Menú JG-OS'],
  ['/ca/', 'Menú JG-OS'],
  ['/en/', 'JG-OS menu'],
] as const) {
  test(`the start button carries the JG-OS name and opens a menu (${path})`, async ({ page }) => {
    await visit(page, path);
    const startBtn = page.locator('[data-start]');
    await expect(startBtn).toHaveText('JG-OS');
    await expect(startBtn).toHaveAccessibleName(name);
    await expect(startBtn).toHaveAttribute('aria-haspopup', 'menu');
    await startBtn.focus();
    await startBtn.press('Enter');
    await expect(page.getByRole('menu', { name })).toBeVisible();
  });
}

test('tabbing out of the start menu closes it', async ({ page }) => {
  await visit(page, '/');
  const startBtn = page.locator('[data-start]');
  const startMenu = page.locator('[data-start-menu]');
  for (const key of ['Tab', 'Shift+Tab']) {
    await startBtn.focus();
    await startBtn.press('Enter');
    await expect(startMenu).toBeVisible();
    await page.keyboard.press(key);
    await expect(startMenu, key).toBeHidden();
    await expect(startBtn).toHaveAttribute('aria-expanded', 'false');
    // Focus moved on, to a control, not lost to the page.
    expect(await page.evaluate(() => document.activeElement !== document.body), key).toBe(true);
  }
});

// ── Keyboard access ───────────────────────────────────────────────────────

test('keyboard reaches every app from the desktop icons and from the start menu', async ({
  page,
}) => {
  await visit(page, '/');
  // Open activity and business from desktop icons
  await openFromIcon(page, 'activity');
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'open');
  await openFromIcon(page, 'business');
  await expect(win(page, 'business')).toHaveAttribute('data-win-state', 'open');
  // Start menu: open and open yokaido
  await page.locator('[data-start]').click();
  await expect(page.locator('[data-start-menu]')).toBeVisible();
  const yokaido = page.locator('[data-start-menu] [data-open-app="yokaido"]');
  await yokaido.click();
  await expect(win(page, 'yokaido')).toHaveAttribute('data-win-state', 'open');
});

// ── Context menu / wallpaper ──────────────────────────────────────────────

test('right-click → Cambiar fondo → Atardecer sets data-wallpaper=sunset and survives a reload', async ({
  page,
}) => {
  await visit(page, '/');
  // Right-click below the about window (y>500) and right of the icon column (x>104),
  // with room for the submenu to expand rightward. No windows in this area.
  await page.locator('[data-desktop]').click({ button: 'right', position: { x: 400, y: 600 } });
  const contextMenu = page.locator('[data-context-menu]');
  await expect(contextMenu).toBeVisible();
  await expect(contextMenu).toHaveAccessibleName('Escritorio');
  // The icons cannot move, so there is nothing to arrange: no such item.
  await expect(contextMenu.getByRole('menuitem')).toHaveText([/^Cambiar fondo/, 'Ordenar ventanas', 'Personalizar…']);
  // Open the wallpaper submenu
  await contextMenu.getByRole('menuitem', { name: /Cambiar fondo/i }).click();
  await contextMenu.getByRole('menuitem', { name: /Atardecer/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'sunset');
  // Reload — the prepaint script restores it from storage
  await visit(page, '/');
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'sunset');
});

test('the context menu is named in the page’s language', async ({ page }) => {
  for (const [path, name] of [
    ['/ca/', 'Escriptori'],
    ['/en/', 'Desktop'],
  ] as const) {
    await visit(page, path);
    await page.locator('[data-desktop]').click({ button: 'right', position: { x: 400, y: 600 } });
    await expect(page.locator('[data-context-menu]')).toHaveAccessibleName(name);
    await page.keyboard.press('Escape');
  }
});

// ── Context menu viewport clamping ────────────────────────────────────────

test('context menu near right edge is clamped within viewport', async ({ page }) => {
  await visit(page, '/');
  const viewport = page.viewportSize()!;
  // Right-click 10px from the right edge — menu would overflow if unclamped.
  await page.locator('[data-desktop]').click({
    button: 'right',
    position: { x: viewport.width - 10, y: 300 },
  });
  const menu = page.locator('[data-context-menu]');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
});

test('context menu near bottom edge is clamped within desktop area', async ({ page }) => {
  await visit(page, '/');
  const viewport = page.viewportSize()!;
  // Right-click 10px from the desktop bottom (viewport - taskbar 40px).
  const desktopBottom = viewport.height - 40;
  await page.locator('[data-desktop]').click({
    button: 'right',
    position: { x: 400, y: desktopBottom - 10 },
  });
  const menu = page.locator('[data-context-menu]');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(desktopBottom + 1);
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
});

// ── Settings app ──────────────────────────────────────────────────────────

test('settings sets the wallpaper and theme without a pointer', async ({ page }) => {
  await visit(page, '/');
  // Open settings from start menu
  await page.locator('[data-start]').click();
  await page.locator('[data-start-menu] [data-open-app="settings"]').click();
  const settings = win(page, 'settings');
  await expect(settings).toHaveAttribute('data-win-state', 'open');
  // Its sections are h2s under the page's one h1: no level skipped.
  await expect(settings.getByRole('heading', { level: 2 })).toHaveCount(3);
  await expect(settings.locator('h1, h3, h4, h5, h6')).toHaveCount(0);
  // Change wallpaper via radio
  const grid = settings.getByRole('radio', { name: /cuadrícula|grid/i });
  await grid.focus();
  await grid.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'grid');
  // Change theme via radio
  const dark = settings.getByRole('radio', { name: /noche|night/i });
  await dark.focus();
  await dark.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

// ── Theme toggle ──────────────────────────────────────────────────────────

test('theme toggle sets data-theme=dark and theme-color follows', async ({ page }) => {
  await visit(page, '/');
  const toggle = page.locator('[data-tray="theme"] button');
  await expect(toggle).toBeVisible();
  // Named by its label, not its glyph; off while day shows.
  await expect(toggle).toHaveAccessibleName('Modo noche');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // theme-color meta must reflect dark colour
  const hasDarkMeta = await page.evaluate(() => {
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    for (const m of metas) {
      if (m.getAttribute('content') === '#141b2b') return true;
    }
    return false;
  });
  expect(hasDarkMeta).toBe(true);
});

// The toggle switches what shows (day ⇄ night), whatever the system theme.
test.describe('on a device whose system theme is dark', () => {
  test.use({ colorScheme: 'dark' });

  /** The desk colour on screen: day or night. */
  const desk = (page: Page) =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--os-desk').trim().toLowerCase());

  test('the night toggle reaches day and back, and says which shows', async ({ page }) => {
    await visit(page, '/');
    const html = page.locator('html');
    const toggle = page.locator('[data-tray="theme"] button');
    // Night shows from the system: the toggle is on.
    expect(await desk(page)).toBe(themeColorDark);
    await expect(toggle).toHaveAccessibleName('Modo noche');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveText('☾');

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    expect(await desk(page)).toBe(themeColor);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(toggle).toHaveText('☀');
    await expect(toggle).toHaveAccessibleName('Modo noche');
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', themeColor);

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await desk(page)).toBe(themeColorDark);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toHaveText('☾');
  });
});

// ── Language link ─────────────────────────────────────────────────────────

test('language link keeps the current path (/work/questday/ → /en/work/questday/)', async ({
  page,
}) => {
  await visit(page, '/work/questday/');
  const enLink = page.locator('[data-tray="language"] a[hreflang="en"]');
  await expect(enLink).toHaveAttribute('href', '/en/work/questday/');
  await enLink.click();
  await expect(page).toHaveURL('/en/work/questday/');
});

// ── Clock ─────────────────────────────────────────────────────────────────

test('clock shows Barcelona time', async ({ page }) => {
  // UTC 2026-11-20T14:30:00Z → Barcelona (CET, UTC+1) = 15:30
  await page.clock.install({ time: new Date('2026-11-20T14:30:00Z') });
  await visit(page, '/');
  const clock = page.locator('[data-tray="clock"]');
  await expect(clock).toBeVisible();
  await expect(clock).toContainText('15:30');
});

// ── Storage resilience ────────────────────────────────────────────────────

test('works when storage throws', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(`${err.name}: ${err.message}`));
  await page.addInitScript(() => {
    // Replace localStorage with a getter that always throws
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked in test');
      },
    });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // No uncaught errors
  expect(pageErrors.filter((e) => !/hydrat|#418|#419|#421|#422|#423|#425/i.test(e))).toHaveLength(
    0,
  );
  // Defaults applied: wallpaper is dots (pre-paint fallback)
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'dots');
});

// ── R4: from a case page every app is reachable ───────────────────────────

test('from a case page every app is reachable', async ({ page }) => {
  await visit(page, '/work/questday/');
  // Every desktop icon is present and visible
  for (const id of DESKTOP_ICON_ORDER) {
    await expect(page.locator(`[data-icon="${id}"]`), `icon ${id}`).toBeVisible();
  }
  // Opening a couple confirms the icons are interactive
  await openFromIcon(page, 'about');
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
  await openFromIcon(page, 'activity');
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'open');
});

// ── R5: document-mode language links ─────────────────────────────────────

test.describe('document-mode language links', () => {
  test.use({ javaScriptEnabled: false });

  test('language links are visible in document mode (no JS)', async ({ page }) => {
    await page.goto('/work/questday/');
    // The os-nojs-only nav renders language links even without JS
    const noJsNav = page.locator('.os-doc-lang');
    await expect(noJsNav).toBeVisible();
    // Links cover all three locales
    await expect(noJsNav.getByRole('link', { name: 'ES' })).toBeVisible();
    await expect(noJsNav.getByRole('link', { name: 'CA' })).toBeVisible();
    await expect(noJsNav.getByRole('link', { name: 'EN' })).toBeVisible();
  });

  test('the language links are named in the page’s language and say which language they lead to', async ({ page }) => {
    for (const [path, name] of [
      ['/work/questday/', 'Idioma'],
      ['/en/work/questday/', 'Language'],
    ] as const) {
      await page.goto(path);
      const noJsNav = page.locator('.os-doc-lang');
      await expect(noJsNav).toHaveAccessibleName(name);
      await expect(noJsNav.getByRole('link', { name: 'CA' })).toHaveAttribute('hreflang', 'ca');
    }
  });
});
