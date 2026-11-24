/**
 * Boot screen and commit-notification toasts.
 *
 * Uses plain @playwright/test — NOT the booted fixture — so the boot screen
 * runs on every full load.  Toast tests install a fake clock near
 * data/activity.json's generatedAt (2026-11-19T21:27:31Z) to keep commit
 * freshness deterministic regardless of when the test suite runs.
 */
import { test, expect, type Page } from '@playwright/test';
import { WELCOME_DELAY_MS, NO_BOOT_DELAY_MS } from '@/os/shell/toast-timing';
import { BOOT_MS } from '@/os/shell/boot-timing';
import { SKIP_BOOT_FLAG } from '@/os/prepaint';

// Clock anchor: close to the most recent commit (rally-voley 2026-11-19T20:50:52Z)
// so rally-voley and sakurai commits are within maxAgeDays=14 of FRESH_NOW.
const FRESH_NOW = new Date('2026-11-20T00:00:00Z');

// 52 days after the newest commit — every commit is older than 14 days.
const STALE_NOW = new Date('2027-01-10T00:00:00Z');

// ── Boot screen ──────────────────────────────────────────────────────────────

test('every full load shows the boot, then the desktop; content is in the DOM underneath from the start', async ({
  page,
}) => {
  // Install a fake clock so we control the 3500 ms auto-dismiss timer.
  await page.clock.install();
  await page.goto('/');

  const bootScreen = page.locator('[data-boot-screen]');

  // The pre-paint inline script sets html[data-boot="1"] before the first
  // paint; CSS makes the boot screen visible immediately.
  await expect(bootScreen).toBeVisible();

  // Content is already in the DOM *while* the boot screen is showing.
  await expect(page.locator('[data-app="welcome"]')).toBeAttached();

  // Wait for React to hydrate.
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Fast-forward past the BOOT_MS auto-dismiss.
  await page.clock.fastForward(BOOT_MS + 100);

  // The boot screen hides (data-boot removed → CSS hides it).
  await expect(bootScreen).not.toBeVisible();

  // jgos-booted is NOT written — the boot happens on every load now.
  const booted = await page.evaluate(() => {
    try {
      return localStorage.getItem('jgos-booted');
    } catch {
      return null;
    }
  });
  expect(booted).toBe(null);
});

// Carried item (Task 14): the boot screen used an undefined token and fell
// back to near-black, where the logo's black frame disappeared. It now sits
// on the desk colour, by day and by night, with the OS ink for its lines.
for (const [colorScheme, desk, ink] of [
  ['light', 'rgb(91, 127, 166)', 'rgb(17, 17, 17)'],
  ['dark', 'rgb(20, 27, 43)', 'rgb(232, 228, 218)'],
] as const) {
  test(`the boot screen sits on the desk colour (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.clock.install();
    await page.goto('/');
    const bootScreen = page.locator('[data-boot-screen]');
    await expect(bootScreen).toBeVisible();
    const look = await bootScreen.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    expect(look).toEqual({ background: desk, color: ink });
  });
}

test('a key press skips the boot immediately', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  const bootScreen = page.locator('[data-boot-screen]');
  await expect(bootScreen).toBeVisible();

  // Wait for hydration so the pre-paint capture listener is running.
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  await page.keyboard.press('Enter');

  await expect(bootScreen).not.toBeVisible();
});

// The boot is bounded from the first paint, not by hydration: the pre-paint
// script's timer removes data-boot after BOOT_MS, so a slow or failed script
// never holds the content back (spec §6.2, anti-goal §4).
test('the boot screen clears on its own when no script runs after the pre-paint', async ({ page }) => {
  // Every script chunk fails; only the inline pre-paint script runs.
  await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const html = page.locator('html');
  const bootScreen = page.locator('[data-boot-screen]');
  await expect(html).toHaveAttribute('data-boot', '1');

  // About BOOT_MS after the first paint (the default expect timeout would hide
  // a screen that never clears behind a slow check).
  await expect(bootScreen).toBeHidden({ timeout: BOOT_MS + 1500 });
  // Nothing hydrated.
  await expect(html).not.toHaveAttribute('data-os-ready', /.*/);
});

test('a returning visitor boots again, on a reload and on a case page', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  const bootScreen = page.locator('[data-boot-screen]');
  await expect(bootScreen).toBeVisible();

  // Fast-forward past BOOT_MS to clear the boot.
  await page.clock.fastForward(BOOT_MS + 100);
  await expect(bootScreen).not.toBeVisible();

  // A reload boots again.
  await page.reload();
  await expect(bootScreen).toBeVisible();

  // Clear it and navigate to a case page — that full load also boots.
  await page.clock.fastForward(BOOT_MS + 100);
  await page.goto('/work/questday/');
  await expect(bootScreen).toBeVisible();
});

test('no boot under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  // The pre-paint script skips data-boot when prefers-reduced-motion is active.
  await expect(page.locator('[data-boot-screen]')).not.toBeVisible();
});

// ── New boot tests ────────────────────────────────────────────────────────────

test('the boot lasts about 3.5 s', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const bootScreen = page.locator('[data-boot-screen]');

  // Before BOOT_MS: still visible.
  await page.clock.fastForward(BOOT_MS - 100);
  await expect(bootScreen).toBeVisible();

  // 200 ms later (100 ms past BOOT_MS): hidden.
  await page.clock.fastForward(200);
  await expect(bootScreen).not.toBeVisible();
});

test('a key press skips the boot even before the page has hydrated', async ({ page }) => {
  // Route every JS chunk through a 3 s delay so hydration has not happened
  // when we press the key.
  await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const html = page.locator('html');
  const bootScreen = page.locator('[data-boot-screen]');

  // Pre-paint has set data-boot="1".
  await expect(html).toHaveAttribute('data-boot', '1');

  // Press a key — the pre-paint capture listener removes data-boot at once.
  await page.keyboard.press('Enter');

  // Boot is gone; the page has NOT hydrated yet.
  await expect(bootScreen).not.toBeVisible();
  await expect(html).not.toHaveAttribute('data-os-ready', /.*/);
});

test('only a full load boots: opening a project and going Back never boot again', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');

  // Skip the boot.
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Open a project via its desktop icon (client-side navigation).
  const questdayIcon = page.locator('[data-icon="questday"]');
  await questdayIcon.focus();
  await questdayIcon.press('Enter');
  await expect(page).toHaveURL('/work/questday/');

  // No new boot on client-side navigation.
  await expect(page.locator('html')).not.toHaveAttribute('data-boot', '1');

  // Go Back — still no boot.
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator('html')).not.toHaveAttribute('data-boot', '1');
});

// ── Boot click / tap behaviour ───────────────────────────────────────────────

// A screen reader activates interactive elements with el.click() (a click with
// no pointer behind it).  The boot's click listener must end the boot without
// swallowing the click when the target is not inside [data-boot-screen].
test('el.click() on the Hablemos button during boot ends the boot and opens Contacto', async ({ page }) => {
  // Navigate without the e2e boot-skip flag so the boot runs.
  await page.goto('/');
  const bootScreen = page.locator('[data-boot-screen]');
  await expect(bootScreen).toBeVisible();
  // Wait for React to hydrate so the OpenAppButton handler is attached.
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // The boot is still running.  Use el.click() to simulate a screen-reader
  // activation of the contact button that is underneath the overlay.
  await page.locator('[data-open-app="contact"]').first().evaluate((el: HTMLElement) => el.click());

  // The click ended the boot.
  await expect(bootScreen).not.toBeVisible();
  // And it was not swallowed — Contacto opened.
  await expect(page.locator('[data-app="contact"]')).toHaveAttribute('data-win-state', 'open');
});

// iOS WebKit only synthesises a click for a tap when the target (or an
// ancestor below <body>) has a click listener or cursor: pointer.  The boot
// screen has neither by default, so tap-to-skip does nothing on iPhone.
// cursor: pointer on [data-boot-screen] is the fix; this test proves the
// touch path in Chromium (hasTouch: true) but cannot prove WebKit — Jesús
// must check on his iPhone.
test('a tap on the boot overlay ends the boot (touch context, Chromium only)', async ({ page, browser }) => {
  const ctx = await browser.newContext({ hasTouch: true });
  const touchPage = await ctx.newPage();
  try {
    await touchPage.goto('/');
    const bootScreen = touchPage.locator('[data-boot-screen]');
    await expect(bootScreen).toBeVisible();
    // Tap the centre of the viewport, which is fully covered by the fixed overlay.
    const viewport = touchPage.viewportSize()!;
    await touchPage.touchscreen.tap(viewport.width / 2, viewport.height / 2);
    await expect(bootScreen).not.toBeVisible();
  } finally {
    await ctx.close();
  }
});

// ── Boot hint text (touch vs keyboard) ───────────────────────────────────────

// On touch screens the hint changes from "Pulsa cualquier tecla…" to "Toca la
// pantalla…".  CSS swaps them with @media (hover: none) and (pointer: coarse).
test('desktop boot shows the keyboard hint', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  const bootScreen = page.locator('[data-boot-screen]');
  await expect(bootScreen).toBeVisible();
  // The key-press hint must be visible and readable.
  const keyHint = page.locator('[data-boot-hint="key"]');
  await expect(keyHint).toBeVisible();
  await expect(keyHint).toHaveText('Pulsa cualquier tecla para continuar');
  // The touch hint must be hidden.
  const touchHint = page.locator('[data-boot-hint="touch"]');
  await expect(touchHint).toBeHidden();
});

test('touch boot shows the touch hint (hasTouch + isMobile, Chromium only)', async ({ page, browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, isMobile: true });
  const touchPage = await ctx.newPage();
  try {
    await touchPage.clock.install();
    await touchPage.goto('/');
    const bootScreen = touchPage.locator('[data-boot-screen]');
    await expect(bootScreen).toBeVisible();
    // The touch hint must be visible and readable.
    const touchHint = touchPage.locator('[data-boot-hint="touch"]');
    await expect(touchHint).toBeVisible();
    await expect(touchHint).toHaveText('Toca la pantalla para continuar');
    // The key hint must be hidden.
    const keyHint = touchPage.locator('[data-boot-hint="key"]');
    await expect(keyHint).toBeHidden();
  } finally {
    await ctx.close();
  }
});

// ── Toasts ───────────────────────────────────────────────────────────────────

test('a fresh commit produces a toast that names the project; it closes with its button', async ({
  page,
}) => {
  // Skip boot via the e2e flag so the no-boot toast delay applies.
  await page.addInitScript((flag) => {
    (window as unknown as Record<string, unknown>)[flag] = true;
  }, SKIP_BOOT_FLAG);

  // Install clock near the snapshot generatedAt: rally-voley (~3 h before) and
  // sakurai (~6.3 days before) are both within maxAgeDays=14.
  await page.clock.install({ time: FRESH_NOW });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Advance past the 8 s welcome toast delay (welcome is open at '/').
  await page.clock.fastForward(WELCOME_DELAY_MS + 500);

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
  await page.addInitScript((flag) => {
    (window as unknown as Record<string, unknown>)[flag] = true;
  }, SKIP_BOOT_FLAG);

  // All activity.json commits are older than 14 days relative to STALE_NOW.
  await page.clock.install({ time: STALE_NOW });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Advance past the welcome toast delay — still no toasts.
  await page.clock.fastForward(WELCOME_DELAY_MS + 500);

  await expect(page.locator('[data-toast]')).toHaveCount(0);
});

test('with the welcome open, the first toast waits about 8 s', async ({ page }) => {
  // Skip boot via the e2e flag.
  await page.addInitScript((flag) => {
    (window as unknown as Record<string, unknown>)[flag] = true;
  }, SKIP_BOOT_FLAG);
  await page.clock.install({ time: FRESH_NOW });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // 7.5 s in — the welcome is open, toast must NOT appear yet.
  await page.clock.fastForward(WELCOME_DELAY_MS - 500);
  await expect(page.locator('[data-toast]')).toHaveCount(0);

  // 1 s more (8.5 s total) — now it should be visible.
  await page.clock.fastForward(1000);
  await expect(page.locator('[data-toast]').first()).toBeVisible();
});

test('a deep link keeps the 1.2 s toast delay', async ({ page }) => {
  // Skip boot via the e2e flag.
  await page.addInitScript((flag) => {
    (window as unknown as Record<string, unknown>)[flag] = true;
  }, SKIP_BOOT_FLAG);
  await page.clock.install({ time: FRESH_NOW });
  // Deep link: welcome is not open, standard no-boot delay applies.
  await page.goto('/work/questday/');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // fastForward past the 1.2 s no-boot delay.
  await page.clock.fastForward(NO_BOOT_DELAY_MS + 300);
  await expect(page.locator('[data-toast]').first()).toBeVisible();
});

test('after the boot screen, the welcome still gets its 8 s', async ({ page }) => {
  // First visit — boot screen shows.
  await page.clock.install({ time: FRESH_NOW });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Advance BOOT_MS + 100 ms to dismiss the boot screen.
  await page.clock.fastForward(BOOT_MS + 100);
  await expect(page.locator('[data-boot-screen]')).not.toBeVisible();

  // 7.5 s after boot — still no toast (welcome is open).
  await page.clock.fastForward(WELCOME_DELAY_MS - 500);
  await expect(page.locator('[data-toast]')).toHaveCount(0);

  // 1 s more (8.5 s after boot) — toast appears.
  await page.clock.fastForward(1000);
  await expect(page.locator('[data-toast]').first()).toBeVisible();
});

// ── Click-through safety ──────────────────────────────────────────────────────

test('desktop: clicking the boot screen dismisses it without opening the app underneath', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');

  const bootScreen = page.locator('[data-boot-screen]');
  await expect(bootScreen).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // projects starts closed by default; clicking its icon would open it.
  // We click the boot screen AT the icon's position to verify that the click
  // is captured by the boot overlay and does NOT reach the icon below.
  const icon = page.locator('[data-icon="projects"]');
  const iconBox = await icon.boundingBox();
  // Without the icon's box the click would land anywhere and prove nothing.
  expect(iconBox).not.toBeNull();
  await page.mouse.click(iconBox!.x + iconBox!.width / 2, iconBox!.y + iconBox!.height / 2);

  // Boot is gone.
  await expect(bootScreen).not.toBeVisible();

  // The projects app was NOT opened by the click (it starts closed).
  await expect(page.locator('[data-app="projects"][data-win-state="open"]')).not.toBeAttached();
});

test('phone: tapping the boot screen dismisses it without opening the app underneath', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/');

  const bootScreen = page.locator('[data-boot-screen]');
  await expect(bootScreen).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // Target the contact button in the welcome card — it exists before and after
  // Task 3, and is always visible in the viewport (top of the scroll area).
  const icon = page.locator('[data-phone-home] button[data-open-app="contact"]');
  const iconBox = await icon.boundingBox();
  expect(iconBox).not.toBeNull();
  // Precondition: the button is inside the viewport.
  expect(iconBox!.y).toBeGreaterThanOrEqual(0);
  expect(iconBox!.y + iconBox!.height).toBeLessThanOrEqual(844);
  await page.mouse.click(iconBox!.x + iconBox!.width / 2, iconBox!.y + iconBox!.height / 2);

  // Boot is gone.
  await expect(bootScreen).not.toBeVisible();

  // The contact app was NOT opened by the tap.
  await expect(page.locator('[data-app="contact"][data-phone-active="true"]')).not.toBeAttached();
});
