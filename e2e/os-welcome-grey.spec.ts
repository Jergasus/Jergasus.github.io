/**
 * TDD: welcome grey colour — desktop icon tile, taskbar button, start-menu entry,
 * window border, and contrast unit.  Write RED, then implement, then confirm GREEN.
 */
import { expect, test, visit, openFromIcon, win } from './fixtures';

const GREY = 'rgb(92, 96, 105)';
const CREAM = 'rgb(237, 231, 217)';

// ---------------------------------------------------------------------------
// Desktop icon tile
// ---------------------------------------------------------------------------

for (const theme of [undefined, 'dark'] as const) {
  test(`welcome desktop icon tile is grey in ${theme ?? 'light'} theme`, async ({ page }) => {
    await visit(page, '/');
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    }
    await expect(page.locator('[data-icon="welcome"] .os-icon-tile'))
      .toHaveCSS('background-color', GREY);
  });
}

// ---------------------------------------------------------------------------
// Taskbar button
// ---------------------------------------------------------------------------

test('welcome taskbar button has a grey background and cream text', async ({ page }) => {
  await visit(page, '/');
  const taskBtn = page.locator('[data-task="welcome"]');
  await expect(taskBtn).toHaveCSS('background-color', GREY);
  await expect(taskBtn).toHaveCSS('color', CREAM);
});

// ---------------------------------------------------------------------------
// Start-menu icon tile
// ---------------------------------------------------------------------------

test('welcome start-menu icon tile is grey', async ({ page }) => {
  await visit(page, '/');
  await page.locator('[data-start]').click();
  await expect(page.locator('[data-start-menu]')).toBeVisible();
  const iconTile = page.locator('[data-start-menu] [data-open-app="welcome"] .os-start-icon');
  await expect(iconTile).toHaveCSS('background-color', GREY);
});

// ---------------------------------------------------------------------------
// Guard: about stays lilac
// ---------------------------------------------------------------------------

test('about desktop icon tile stays lilac (guard)', async ({ page }) => {
  await visit(page, '/');
  // about uses --os-c-lilac = #c9b8ff = rgb(201, 184, 255)
  await expect(page.locator('[data-icon="about"] .os-icon-tile'))
    .toHaveCSS('background-color', 'rgb(201, 184, 255)');
});

// ---------------------------------------------------------------------------
// Window border
// ---------------------------------------------------------------------------

test('welcome window border is grey', async ({ page }) => {
  await visit(page, '/');
  await expect(win(page, 'welcome')).toHaveCSS('border-top-color', GREY);
});

test('welcome window border is grey in dark theme', async ({ page }) => {
  await visit(page, '/');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await expect(win(page, 'welcome')).toHaveCSS('border-top-color', GREY);
});

test('about window border is not grey (guard: other windows keep the OS border)', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'about');
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
  // about keeps --os-border (#111111 in light = rgb(17, 17, 17))
  await expect(win(page, 'about')).toHaveCSS('border-top-color', 'rgb(17, 17, 17)');
});
