import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { AppId } from '@/os/apps';

// React reports a hydration mismatch as a recoverable error: a console error
// (or an uncaught error in production builds, where the message is the
// minified #418-#425 family). Any of them fails the test that saw it.
const HYDRATION = /hydrat|did not match|Minified React error #(418|419|421|422|423|425)\b/i;

export const test = base.extend({
  page: async ({ page }, run) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && HYDRATION.test(message.text())) errors.push(message.text());
    });
    page.on('pageerror', (error) => {
      if (HYDRATION.test(`${error.name}: ${error.message}`)) errors.push(error.message);
    });
    // A returning visitor: the boot screen (first visit only) stays out of the way.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('jgos-booted', '1');
      } catch {
        // Storage may be blocked; the OS works without it.
      }
    });
    await run(page);
    expect(errors, 'React hydration errors').toEqual([]);
  },
});

export { expect };

/** A window by its app id. */
export const win = (page: Page, id: AppId): Locator => page.locator(`[data-app="${id}"]`);

/** The taskbar. */
export const taskbar = (page: Page): Locator => page.locator('[data-taskbar]');

/** Opens an app from its desktop icon, the way a keyboard user does. */
export async function openFromIcon(page: Page, id: AppId): Promise<void> {
  const icon = page.locator(`[data-icon="${id}"]`);
  await icon.focus();
  await icon.press('Enter');
}

/**
 * Goes to a page and waits until the OS has hydrated, so clicks reach React.
 * Only for tests with JavaScript on.
 */
export async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');
  return response;
}

/** Brings a window to the front the way a keyboard user does: by moving focus into it. */
export async function bringToFront(page: Page, id: AppId): Promise<void> {
  await win(page, id).focus();
  await expect(win(page, id)).toHaveAttribute('data-focused', 'true');
}
