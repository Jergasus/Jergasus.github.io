/**
 * Boot screen and commit-notification toasts.
 *
 * Uses plain @playwright/test — NOT the booted fixture — so the boot screen
 * runs on first visit.  Toast tests install a fake clock near
 * data/activity.json's generatedAt (2026-11-19T21:27:31Z) to keep commit
 * freshness deterministic regardless of when the test suite runs.
 */
import { test, expect } from '@playwright/test';

// Clock anchor: close to the most recent commit (rally-voley 2026-11-19T20:50:52Z)
// so rally-voley and sakurai commits are within maxAgeDays=14 of FRESH_NOW.
const FRESH_NOW = new Date('2026-11-20T00:00:00Z');

// 52 days after the newest commit — every commit is older than 14 days.
const STALE_NOW = new Date('2027-01-10T00:00:00Z');

// ── Boot screen ──────────────────────────────────────────────────────────────

test('first visit shows the boot screen, then the desktop; content is in the DOM underneath from the start', async ({
  page,
}) => {
  // Install a fake clock so we control the 1100 ms auto-dismiss timer.
  await page.clock.install();
  await page.goto('/');

  const bootScreen = page.locator('[data-boot-screen]');

  // The pre-paint inline script sets html[data-boot="1"] before the first
  // paint; CSS makes the boot screen visible immediately.
  await expect(bootScreen).toBeVisible();

  // Content is already in the DOM *while* the boot screen is showing.
  await expect(page.locator('[data-app="about"]')).toBeAttached();

  // Wait for React to hydrate (the boot timer starts in useEffect).
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Fast-forward past the 1100 ms auto-dismiss.
  await page.clock.fastForward(1200);

  // The boot screen hides (data-boot removed → CSS hides it).
  await expect(bootScreen).not.toBeVisible();

  // jgos-booted=1 is persisted so the second visit skips the boot.
  const booted = await page.evaluate(() => {
    try {
      return localStorage.getItem('jgos-booted');
    } catch {
      return null;
    }
  });
  expect(booted).toBe('1');
});

test('a key press skips the boot immediately', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  const bootScreen = page.locator('[data-boot-screen]');
  await expect(bootScreen).toBeVisible();

  // Wait for the keydown listener to be attached (useEffect after hydration).
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  await page.keyboard.press('Enter');

  await expect(bootScreen).not.toBeVisible();
});

test('second visit has no boot', async ({ page }) => {
  // Simulate a returning visitor: jgos-booted=1 already in localStorage.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jgos-booted', '1');
    } catch {
      // storage unavailable — test still passes; the OS works without it.
    }
  });

  await page.goto('/');

  // The pre-paint script never sets data-boot when jgos-booted=1 is present.
  await expect(page.locator('[data-boot-screen]')).not.toBeVisible();
});

test('no boot under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  // The pre-paint script skips data-boot when prefers-reduced-motion is active.
  await expect(page.locator('[data-boot-screen]')).not.toBeVisible();
});

// ── Toasts ───────────────────────────────────────────────────────────────────

test('a fresh commit produces a toast that names the project; it closes with its button', async ({
  page,
}) => {
  // Returning visitor — no boot, so the 1200 ms "no-boot" delay applies.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jgos-booted', '1');
    } catch {}
  });

  // Install clock near the snapshot generatedAt: rally-voley (~3 h before) and
  // sakurai (~6.3 days before) are both within maxAgeDays=14.
  await page.clock.install({ time: FRESH_NOW });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Advance past the 1200 ms "no-boot" toast delay.
  await page.clock.fastForward(1500);

  // At least one toast should appear.
  const toast = page.locator('[data-toast]').first();
  await expect(toast).toBeVisible();

  // The toast names the project (rally-voley, the most-recent commit).
  await expect(toast).toContainText('Rally Voley');

  // The close button dismisses it.
  const closeBtn = toast.locator('button');
  await expect(closeBtn).toHaveAccessibleName(/cerrar|dismiss|tancar/i);
  await closeBtn.click();
  await expect(toast).not.toBeVisible();
});

test('no toast when every commit is older than 14 days', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('jgos-booted', '1');
    } catch {}
  });

  // All activity.json commits are older than 14 days relative to STALE_NOW.
  await page.clock.install({ time: STALE_NOW });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Advance past the toast delay — still no toasts.
  await page.clock.fastForward(1500);

  await expect(page.locator('[data-toast]')).toHaveCount(0);
});
