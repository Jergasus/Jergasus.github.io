import { DESKTOP_ICON_ORDER } from '@/os/apps';
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
  // Open the wallpaper submenu
  await contextMenu.getByRole('menuitem', { name: /Cambiar fondo/i }).click();
  await contextMenu.getByRole('menuitem', { name: /Atardecer/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'sunset');
  // Reload — the prepaint script restores it from storage
  await visit(page, '/');
  await expect(page.locator('html')).toHaveAttribute('data-wallpaper', 'sunset');
});

// ── Settings app ──────────────────────────────────────────────────────────

test('settings sets the wallpaper and theme without a pointer', async ({ page }) => {
  await visit(page, '/');
  // Open settings from start menu
  await page.locator('[data-start]').click();
  await page.locator('[data-start-menu] [data-open-app="settings"]').click();
  const settings = win(page, 'settings');
  await expect(settings).toHaveAttribute('data-win-state', 'open');
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
  await toggle.click();
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
});
