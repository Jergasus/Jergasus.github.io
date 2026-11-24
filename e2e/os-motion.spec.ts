import type { Locator, Page } from '@playwright/test';
import { expect, openFromIcon, tapInView, taskbar, test, visit, win } from './fixtures';
import { PHONE_ICON_ORDER } from '@/os/apps';
import { WELCOME_DELAY_MS } from '@/os/shell/toast-timing';

/**
 * JG-OS motion (spec §6.4). E2E builds expose window.__motionDebug (ruling R4,
 * src/components/motion/debug.ts):
 * - played: the sequences that ran in this document, in order;
 * - properties(): every property GSAP has tweened so far;
 * - timeScale(n): slows every tween, so a test can act mid-animation.
 * Every state change commits at once; the motion only draws on top of it.
 */
type MotionDebug = { properties: () => string[]; played: string[]; timeScale: (scale: number) => void };
type DebugWindow = Window & { __motionDebug?: MotionDebug };

// Transform aliases and opacity: nothing that needs layout or paint.
const ANIMATABLE = ['x', 'y', 'xPercent', 'yPercent', 'scale', 'scaleX', 'scaleY', 'opacity'];

/** Slow enough that every check below lands mid-animation (0.28 s becomes 14 s). */
const SLOW = 0.02;
/**
 * Slow enough to read where a sequence starts (0.28 s becomes 47 minutes):
 * at SLOW the ease-out's first frames still travel several pixels for every
 * tick a busy machine takes before the read, and that read flaked under load.
 * (A time scale of 0 drew the sequences at their end, so the clock is
 * slowed, not stopped.)
 */
const FROZEN = 0.0001;

async function ready(page: Page, path = '/') {
  await visit(page, path);
  await expect
    .poll(() => page.evaluate(() => Boolean((window as DebugWindow).__motionDebug)), {
      message: 'window.__motionDebug is missing: run e2e on a NEXT_PUBLIC_E2E=1 build (nothing else on :4173)',
    })
    .toBe(true);
}

const played = (page: Page) => page.evaluate(() => [...((window as DebugWindow).__motionDebug?.played ?? [])]);
const properties = (page: Page) => page.evaluate(() => (window as DebugWindow).__motionDebug?.properties() ?? []);
const timeScale = (page: Page, scale: number) =>
  page.evaluate((value) => (window as DebugWindow).__motionDebug!.timeScale(value), scale);

const notAnimatable = async (page: Page) => (await properties(page)).filter((name) => !ANIMATABLE.includes(name));

/** No sequence in flight: no outline, no element held by the motion layer. */
async function settled(page: Page) {
  await expect(page.locator('[data-motion-outline]')).toHaveCount(0);
  await expect(page.locator('[data-motion]')).toHaveCount(0);
}

/** What the motion layer may have left on an element. */
const leftovers = (element: Locator) =>
  element.evaluate((node: HTMLElement) => ({
    transform: node.style.transform,
    opacity: node.style.opacity,
    inert: node.inert,
    motion: node.getAttribute('data-motion'),
  }));
const CLEAN = { transform: '', opacity: '', inert: false, motion: null };

/** The look of a window right now, read once (no retries): what "instant" means. */
const looksNow = (page: Page, id: string) =>
  page.evaluate((app) => {
    const node = document.querySelector<HTMLElement>(`[data-app="${app}"]`)!;
    const style = getComputedStyle(node);
    return {
      display: style.display,
      opacity: style.opacity,
      transform: style.transform,
      state: node.getAttribute('data-win-state'),
      motion: node.getAttribute('data-motion'),
      outlines: [...document.querySelectorAll('[data-motion-outline]')].map((o) => o.getAttribute('data-motion-outline')),
    };
  }, id);

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** Where an outline is drawn right now: the box around its four edges. */
const drawn = (page: Page, kind: 'open' | 'close') =>
  page.locator(`[data-motion-outline="${kind}"]`).evaluate((outline) => {
    const edges = [...outline.children].map((edge) => edge.getBoundingClientRect());
    const x = Math.min(...edges.map((edge) => edge.left));
    const y = Math.min(...edges.map((edge) => edge.top));
    return {
      x,
      y,
      width: Math.max(...edges.map((edge) => edge.right)) - x,
      height: Math.max(...edges.map((edge) => edge.bottom)) - y,
    };
  });

// ── Desktop ───────────────────────────────────────────────────────────────

test('opening a window plays os-open and tweens only transform/opacity', async ({ page }) => {
  await ready(page);
  const contact = win(page, 'contact');

  await openFromIcon(page, 'contact');
  // The state is final at once; only the picture catches up.
  await expect(contact).toHaveAttribute('data-win-state', 'open');
  await expect.poll(() => played(page)).toContain('os-open');

  await settled(page);
  await expect(contact).toBeVisible();
  expect(await leftovers(contact)).toEqual(CLEAN);
  expect(await properties(page)).toEqual(expect.arrayContaining(['opacity', 'scaleX', 'scaleY', 'x', 'y']));
  expect(await notAnimatable(page)).toEqual([]);
});

test('the open outline grows from the icon while the window waits for it', async ({ page }) => {
  await ready(page);
  await timeScale(page, FROZEN);
  const icon = page.locator('[data-icon="contact"]');
  const iconBox = await box(icon);

  await openFromIcon(page, 'contact');
  await expect(page.locator('[data-motion-outline="open"]')).toHaveCount(1);
  // It starts on the icon...
  const start = await drawn(page, 'open');
  expect(Math.abs(start.x - iconBox.x)).toBeLessThan(6);
  expect(Math.abs(start.y - iconBox.y)).toBeLessThan(6);
  expect(Math.abs(start.width - iconBox.width)).toBeLessThan(6);
  expect(Math.abs(start.height - iconBox.height)).toBeLessThan(6);
  // ...drawn with whole 2 px edges, not a line scaled down to nothing.
  const edges = await page
    .locator('[data-motion-outline="open"] > *')
    .evaluateAll((all) => all.map((edge) => edge.getBoundingClientRect()));
  for (const edge of edges) expect(Math.min(edge.width, edge.height)).toBeCloseTo(2, 0);
  // ...and the window only appears once it lands.
  const now = await looksNow(page, 'contact');
  expect(now).toMatchObject({ state: 'open', opacity: '0', motion: 'in' });

  await timeScale(page, 1);
  await settled(page);
  expect(await looksNow(page, 'contact')).toMatchObject({ opacity: '1', transform: 'none' });
});

test('minimising plays os-minimize', async ({ page }) => {
  await ready(page);
  const welcome = win(page, 'welcome');

  await welcome.locator('[data-win-minimize]').click();
  await expect(welcome).toHaveAttribute('data-win-state', 'minimized');
  await expect.poll(() => played(page)).toContain('os-minimize');

  await settled(page);
  await expect(welcome).toBeHidden();
  expect(await leftovers(welcome)).toEqual(CLEAN);
  expect(await notAnimatable(page)).toEqual([]);
});

test('a minimising window heads for its taskbar button and cannot be used on the way', async ({ page }) => {
  await ready(page);
  const welcome = win(page, 'welcome');
  const before = await box(welcome);
  await timeScale(page, SLOW);

  await welcome.locator('[data-win-minimize]').click();
  expect(await leftovers(welcome)).toMatchObject({ inert: true, motion: 'out' });
  await expect(taskbar(page).locator('[data-task="welcome"]')).toHaveAttribute('aria-pressed', 'false');
  // A few steps in, it is smaller and closer to the taskbar.
  await expect.poll(async () => (await box(welcome)).width).toBeLessThan(before.width - 2);
  expect((await box(welcome)).y).toBeGreaterThan(before.y);

  await timeScale(page, 1);
  await settled(page);
  await expect(welcome).toBeHidden();
});

test('closing plays os-close and leaves the window closed at once', async ({ page }) => {
  await ready(page);
  const welcome = win(page, 'welcome');

  await welcome.locator('[data-win-close]').click();
  expect(await looksNow(page, 'welcome')).toMatchObject({ display: 'none', state: 'closed' });
  await expect.poll(() => played(page)).toContain('os-close');
  await settled(page);
  expect(await notAnimatable(page)).toEqual([]);
});

test('windows on the first paint do not animate in', async ({ page }) => {
  for (const path of ['/', '/work/questday/']) {
    await ready(page, path);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    // Toasts may slide in on their own timer; no window does.
    expect((await played(page)).filter((name) => name !== 'os-toast')).toEqual([]);
    await expect(page.locator('[data-motion-outline]')).toHaveCount(0);
    for (const id of ['welcome', 'about', 'projects'] as const) expect(await leftovers(win(page, id))).toEqual(CLEAN);
  }
});

// ── Interruption: animations never block input ───────────────────────────

test('acting mid-animation jumps to the final state', async ({ page }) => {
  await ready(page);
  const contact = win(page, 'contact');
  await timeScale(page, SLOW);

  // Close during open: the open is over at once, then the close outline runs.
  await openFromIcon(page, 'contact');
  await expect(page.locator('[data-motion-outline="open"]')).toHaveCount(1);
  await contact.locator('[data-win-close]').click();
  expect(await looksNow(page, 'contact')).toMatchObject({
    display: 'none',
    state: 'closed',
    motion: null,
    outlines: ['close'],
  });
  expect(await leftovers(contact)).toEqual(CLEAN);

  // Open again during the close: the close outline goes, a fresh open starts.
  await openFromIcon(page, 'contact');
  expect(await looksNow(page, 'contact')).toMatchObject({ state: 'open', motion: 'in', outlines: ['open'] });

  // Minimise during open.
  await contact.locator('[data-win-minimize]').click();
  expect(await looksNow(page, 'contact')).toMatchObject({ state: 'minimized', motion: 'out', outlines: [] });

  // Restore from the taskbar during the minimise: the open grows from the button.
  const button = taskbar(page).locator('[data-task="contact"]');
  const buttonBox = await box(button);
  await timeScale(page, FROZEN);
  await button.click();
  expect(await looksNow(page, 'contact')).toMatchObject({ state: 'open', motion: 'in', outlines: ['open'] });
  const start = await drawn(page, 'open');
  expect(Math.abs(start.x - buttonBox.x)).toBeLessThan(6);
  expect(Math.abs(start.y - buttonBox.y)).toBeLessThan(6);

  // Activating it again while it opens shows it at once.
  await openFromIcon(page, 'contact');
  expect(await looksNow(page, 'contact')).toMatchObject({
    display: 'flex',
    state: 'open',
    opacity: '1',
    transform: 'none',
    motion: null,
    outlines: [],
  });
  expect(await leftovers(contact)).toEqual(CLEAN);

  await timeScale(page, 1);
  await settled(page);
});

test('fast taskbar toggles end where the clicks say, with nothing held back', async ({ page }) => {
  await ready(page);
  const welcome = win(page, 'welcome');
  await welcome.focus();
  const button = taskbar(page).locator('[data-task="welcome"]');

  // minimise, restore, minimise, restore, minimise
  for (let i = 0; i < 5; i++) await button.click();
  await expect(welcome).toHaveAttribute('data-win-state', 'minimized');
  await settled(page);
  await expect(welcome).toBeHidden();
  expect(await leftovers(welcome)).toEqual(CLEAN);

  await button.click();
  await expect(welcome).toHaveAttribute('data-win-state', 'open');
  await settled(page);
  await expect(welcome).toBeVisible();
  expect(await leftovers(welcome)).toEqual(CLEAN);
});

test('a phone/desktop switch or a route change mid-animation leaves nothing hidden', async ({ page }) => {
  await ready(page);
  await timeScale(page, SLOW);

  await openFromIcon(page, 'contact');
  await expect(page.locator('[data-motion-outline="open"]')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-os', 'phone');
  await settled(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('html')).toHaveAttribute('data-os', 'desktop');
  expect(await leftovers(win(page, 'contact'))).toEqual(CLEAN);
  await expect(win(page, 'contact')).toBeVisible();

  // A project opens by moving the URL; Back mid-open takes it away again.
  await openFromIcon(page, 'questday');
  await expect(page).toHaveURL('/work/questday/');
  await expect(page.locator('[data-motion-outline="open"]')).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL('/');
  await settled(page);
  for (const id of ['welcome', 'contact'] as const) {
    expect(await leftovers(win(page, id))).toEqual(CLEAN);
  }
});

// ── Phone ─────────────────────────────────────────────────────────────────

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('phone app open plays os-phone-open', async ({ page }) => {
    await ready(page);
    const contact = win(page, 'contact');

    await page.locator('[data-phone-icon="contact"]').tap();
    await expect(contact).toHaveAttribute('data-phone-active', 'true');
    await expect.poll(() => played(page)).toContain('os-phone-open');
    await settled(page);
    await expect(contact).toBeVisible();
    expect(await leftovers(contact)).toEqual(CLEAN);

    // It closes back into its icon.
    await page.locator('[data-phone-active="true"] [data-phone-back]').tap();
    await expect(contact).toHaveAttribute('data-phone-active', 'false');
    await expect.poll(() => played(page)).toContain('os-phone-close');
    await settled(page);
    expect(await notAnimatable(page)).toEqual([]);
  });

  test('closing a phone app shrinks the app itself back into its icon (no outline)', async ({ page }) => {
    await ready(page);
    const contact = win(page, 'contact');
    const icon = page.locator('[data-phone-icon="contact"]');
    await icon.scrollIntoViewIfNeeded();
    const iconBox = await box(icon);
    await icon.tap();
    await expect(contact).toHaveAttribute('data-phone-active', 'true');
    await settled(page);
    const full = await box(contact);
    const centre = (b: { x: number; y: number; width: number; height: number }) => ({
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
    });
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    await timeScale(page, SLOW);

    await page.locator('[data-phone-active="true"] [data-phone-back]').tap();
    // The state is final at once, with home showing underneath; the app is
    // only drawn (and unusable) on its way back into the icon.
    await expect(contact).toHaveAttribute('data-phone-active', 'false');
    await expect(page.locator('[data-phone-home]')).toBeVisible();
    expect(await looksNow(page, 'contact')).toMatchObject({ display: 'flex', motion: 'out', outlines: [] });
    expect(await leftovers(contact)).toMatchObject({ inert: true, motion: 'out' });
    await expect.poll(async () => (await box(contact)).width, { timeout: 10_000 }).toBeLessThan(full.width - 2);
    expect(distance(centre(await box(contact)), centre(iconBox))).toBeLessThan(distance(centre(full), centre(iconBox)));

    await timeScale(page, 1);
    await settled(page);
    await expect(contact).toBeHidden();
    expect(await leftovers(contact)).toEqual(CLEAN);
    expect(await played(page)).toContain('os-phone-close');
    expect(await notAnimatable(page)).toEqual([]);
  });

  test('a project app closes into its icon before the URL goes home', async ({ page }) => {
    await ready(page);
    const questday = win(page, 'questday');
    await page.locator('[data-phone-icon="questday"]').tap();
    await expect(page).toHaveURL('/work/questday/');
    await settled(page);
    await timeScale(page, SLOW);

    await page.locator('[data-phone-active="true"] [data-phone-back]').tap();
    await expect(questday).toHaveAttribute('data-phone-active', 'false');
    // Still on the page (the route would unmount it): held on its way out.
    expect(await leftovers(questday)).toMatchObject({ inert: true, motion: 'out' });
    expect(await looksNow(page, 'questday')).toMatchObject({ display: 'flex', outlines: [] });

    await timeScale(page, 1);
    await expect(page).toHaveURL('/');
    await settled(page);
    await expect(questday).toHaveCount(0);
    expect(await played(page)).toContain('os-phone-close');
  });

  test('an icon partly under the dock: the app grows from it, and closing it leaves the home where it was', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await ready(page);
    const id = PHONE_ICON_ORDER.at(-1)!;
    const scroll = page.locator('.os-phone-scroll');
    const icon = page.locator(`[data-phone-icon="${id}"]`);

    // Position the icon so its centre is exactly at the scroll area's bottom edge.
    await scroll.evaluate((el, selector) => {
      const target = el.querySelector(selector)!.getBoundingClientRect();
      el.scrollTo({
        top: el.scrollTop + target.top + target.height / 2 - el.getBoundingClientRect().bottom,
        behavior: 'instant',
      });
    }, `[data-phone-icon="${id}"]`);

    // Poll until the scroll settles (two reads a frame apart agree).
    await expect.poll(async () => {
      const a = await scroll.evaluate((el) => el.scrollTop);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      const b = await scroll.evaluate((el) => el.scrollTop);
      return a === b ? a : null;
    }, { timeout: 2000 }).not.toBeNull();

    const before = await scroll.evaluate((el) => el.scrollTop);
    const area = await box(scroll);
    const iconBox = await box(icon);

    // The icon is partly shown and partly hidden below the scroll area.
    expect(iconBox.y).toBeLessThan(area.y + area.height - 10);
    expect(iconBox.y + iconBox.height).toBeGreaterThan(area.y + area.height + 10);

    await timeScale(page, FROZEN);
    await tapInView(page, icon);

    // The app starts at the icon's position, and the scroll did not move.
    const start = await box(win(page, id));
    expect(Math.abs(start.x - iconBox.x)).toBeLessThan(6);
    expect(Math.abs(start.y - iconBox.y)).toBeLessThan(6);
    expect(await scroll.evaluate((el) => el.scrollTop)).toBe(before);

    await timeScale(page, 1);
    await settled(page);
    expect((await box(win(page, id))).width).toBeGreaterThan(360);

    // Close and verify focus returns to the icon without moving the scroll.
    await page.locator('[data-phone-active="true"] [data-win-close]').tap();
    await settled(page);
    await expect(icon).toBeFocused();
    expect(await scroll.evaluate((el) => el.scrollTop)).toBe(before);
  });
});

// ── Toasts and boot ───────────────────────────────────────────────────────

test('a toast slides in (os-toast) and slides out when dismissed', async ({ page }) => {
  // Within 14 days of the newest commit in data/activity.json.
  await page.clock.install({ time: new Date('2026-11-20T00:00:00Z') });
  await ready(page);
  // Welcome is open at '/', so the toast waits 8 s.
  await page.clock.fastForward(WELCOME_DELAY_MS + 500);

  // The newest commit's toast comes first (the next one waits 2 s).
  const toast = page.locator('[data-toast]', { hasText: 'Rally Voley' });
  await expect(toast).toBeVisible();
  await expect.poll(() => played(page)).toContain('os-toast');
  await expect.poll(() => toast.evaluate((node: HTMLElement) => node.style.transform)).toBe('');

  await toast.getByRole('button').click();
  await expect(toast).toHaveCount(0);
  expect(await notAnimatable(page)).toEqual([]);
});

test('the boot shows the skip hint first, then prints a line every step', async ({ context }) => {
  // A first visit: a page without the fixture's boot-skip flag.
  const page = await context.newPage();
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('[data-boot-screen]')).toBeVisible();
  // DOM order: four lines (steps 1–4) then the two hints (both step 0).
  const delays = await page
    .locator('[data-boot-screen] > p')
    .evaluateAll((lines) => lines.map((line) => getComputedStyle(line).animationDelay));
  expect(delays).toEqual(['0.7s', '1.4s', '2.1s', '2.8s', '0s', '0s']);
});

// ── Reduced motion and no JavaScript ──────────────────────────────────────

test('reduced motion: nothing plays and state changes are instant', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);

  await openFromIcon(page, 'contact');
  expect(await looksNow(page, 'contact')).toMatchObject({
    display: 'flex',
    opacity: '1',
    transform: 'none',
    state: 'open',
    outlines: [],
  });
  await win(page, 'contact').locator('[data-win-minimize]').click();
  expect(await looksNow(page, 'contact')).toMatchObject({ display: 'none', state: 'minimized', motion: null });
  await taskbar(page).locator('[data-task="contact"]').click();
  expect(await looksNow(page, 'contact')).toMatchObject({ display: 'flex', opacity: '1', outlines: [] });
  await win(page, 'contact').locator('[data-win-close]').click();
  expect(await looksNow(page, 'contact')).toMatchObject({ display: 'none', outlines: [] });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).toHaveAttribute('data-os', 'phone');
  await page.locator('[data-phone-icon="contact"]').click();
  expect(await looksNow(page, 'contact')).toMatchObject({ display: 'flex', opacity: '1', transform: 'none' });

  expect(await played(page)).toEqual([]);
  expect(await properties(page)).toEqual([]);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JS nothing is hidden', async ({ page }) => {
    for (const path of ['/', '/work/questday/']) {
      await page.goto(path);
      const held = await page.locator('[data-app]:not([data-interactive-only])').evaluateAll((windows) =>
        windows
          .map((node) => {
            const style = getComputedStyle(node);
            return {
              id: node.getAttribute('data-app'),
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              transform: style.transform,
            };
          })
          .filter((look) => look.display === 'none' || look.visibility !== 'visible' || look.opacity !== '1' || look.transform !== 'none'),
      );
      expect(held, path).toEqual([]);
      await expect(page.locator('[data-motion], [data-motion-outline]')).toHaveCount(0);
      await expect(page.locator('h1')).toBeVisible();
    }
  });
});
