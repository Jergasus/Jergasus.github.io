import { expect, openFromIcon, test, visit, win } from './fixtures';
import { DESKTOP_ICON_ORDER } from '@/os/apps';

test('the desktop shows every app\'s icon, Bienvenida first', async ({ page }) => {
  await visit(page, '/');
  await expect(page.locator('[data-icon] .os-icon-label')).toHaveText([
    'Bienvenida', 'Sobre mí', 'Proyectos', 'QuestDay', 'SakurAI', 'Rally Voley', 'Yokaido',
    'Actividad', 'Nuevo proyecto', 'Contacto', 'Terminal', 'Navegador', 'Personalizar',
  ]);
});

test('Bienvenida reopens the welcome; closing the welcome puts focus on the Bienvenida icon', async ({ page }) => {
  await visit(page, '/');
  // The welcome is open on load. Close it via the × button.
  await win(page, 'welcome').locator('[data-win-close]').click();
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'closed');

  // The Bienvenida icon should be focused after close.
  await expect(page.locator('[data-icon="welcome"]')).toBeFocused();

  // Press Enter on the icon to reopen.
  await page.locator('[data-icon="welcome"]').press('Enter');
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'welcome')).toBeFocused();
});

test('arrow keys move between the desktop icons', async ({ page }) => {
  await visit(page, '/');
  const firstIcon = page.locator('[data-icon="welcome"]');
  await firstIcon.focus();

  // ArrowDown moves to about.
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-icon="about"]')).toBeFocused();
  await expect(page.locator('[data-icon="about"]')).toHaveClass(/os-icon--selected/);

  // ArrowUp moves back to welcome.
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-icon="welcome"]')).toBeFocused();
});

test('Personalizar opens from the right-click menu, the JG-OS menu and its desktop icon', async ({ page }) => {
  await visit(page, '/');

  // Close the welcome window so the desktop background is clear for right-click.
  await win(page, 'welcome').locator('[data-win-close]').click();
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'closed');

  // 1. Right-click menu — click on the empty desktop background (far from windows).
  await page.mouse.click(900, 400, { button: 'right' });
  await expect(page.locator('[data-context-menu]')).toBeVisible();
  await page.locator('[data-context-menu]').getByRole('menuitem', { name: /Personalizar/i }).click();
  await expect(win(page, 'settings')).toHaveAttribute('data-win-state', 'open');
  await win(page, 'settings').locator('[data-win-close]').click();
  await expect(win(page, 'settings')).toHaveAttribute('data-win-state', 'closed');

  // 2. JG-OS menu (start menu).
  await page.locator('[data-start]').click();
  await page.locator('[data-start-menu] [data-open-app="settings"]').click();
  await expect(win(page, 'settings')).toHaveAttribute('data-win-state', 'open');
  await win(page, 'settings').locator('[data-win-close]').click();
  await expect(win(page, 'settings')).toHaveAttribute('data-win-state', 'closed');

  // 3. Desktop icon.
  await openFromIcon(page, 'settings');
  await expect(win(page, 'settings')).toHaveAttribute('data-win-state', 'open');
});

test('DESKTOP_ICON_ORDER has 13 entries', async ({ page }) => {
  await visit(page, '/');
  const icons = page.locator('[data-icon]');
  await expect(icons).toHaveCount(DESKTOP_ICON_ORDER.length);
});
