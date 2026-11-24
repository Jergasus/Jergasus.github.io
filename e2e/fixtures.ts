import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { AppId } from '@/os/apps';
import { SKIP_BOOT_FLAG } from '@/os/prepaint';

/**
 * Taps the middle of the target's visible part using raw touchscreen events.
 * Never scrolls first; finds the target's nearest scrolling ancestor,
 * intersects the two boxes, and taps the visible center.
 * Requires hasTouch: true in the test context.
 */
export async function tapInView(page: Page, target: Locator): Promise<void> {
  const scrollerRect = await target.evaluate((el) => {
    let cur: Element | null = el.parentElement;
    while (cur) {
      const style = getComputedStyle(cur);
      const oy = style.overflowY;
      if (oy === 'auto' || oy === 'scroll') {
        const r = cur.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      }
      cur = cur.parentElement;
    }
    return null;
  });

  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error('tapInView: target has no bounding box');

  if (!scrollerRect) {
    await page.touchscreen.tap(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
    return;
  }

  // Intersect the target's box with the scroll container's visible area.
  const left = Math.max(targetBox.x, scrollerRect.x);
  const top = Math.max(targetBox.y, scrollerRect.y);
  const right = Math.min(targetBox.x + targetBox.width, scrollerRect.x + scrollerRect.width);
  const bottom = Math.min(targetBox.y + targetBox.height, scrollerRect.y + scrollerRect.height);

  if (right <= left || bottom <= top) {
    throw new Error('tapInView: target is not visible within its scroll container');
  }

  await page.touchscreen.tap((left + right) / 2, (top + bottom) / 2);
}

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
    // Skip the boot screen in this e2e build (NEXT_PUBLIC_E2E=1).
    // The flag is checked by the pre-paint IIFE; it is never present in deploy builds.
    await page.addInitScript((flag) => {
      (window as unknown as Record<string, unknown>)[flag] = true;
    }, SKIP_BOOT_FLAG);
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

/**
 * Opens an app via the Start menu, the way a keyboard user does.
 * Clicks [data-start], then the matching entry, then waits for the window to open.
 */
export async function openFromStart(page: Page, id: AppId): Promise<void> {
  await page.locator('[data-start]').click();
  await page.locator(`[data-start-menu] [data-open-app="${id}"]`).click();
  await expect(win(page, id)).toHaveAttribute('data-win-state', 'open');
}

