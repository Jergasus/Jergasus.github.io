import type { Page } from '@playwright/test';
import type { AppId } from '@/os/apps';
import { expect, test, visit, win } from './fixtures';

// Visual QA (spec §6): screenshots for the welcome-window feature at
// 375×812, 768×1024, 1024×640, 1280×720, 1440×900 and 1920×1080. Taken with
// reduced motion so nothing is caught mid-animation. Written to
// test-results/screens/ (gitignored, cleared by every run), or to SCREENS_DIR
// when set. Below 64 rem the site renders as the phone; 1024+ shows the
// desktop.
test.use({ reducedMotion: 'reduce' });

const DIR = process.env.SCREENS_DIR ?? 'test-results/screens';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 640 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];

type Shot = {
  name: string;
  path: string;
  /** A phone app to open from its icon. */
  phoneApp?: AppId;
  colorScheme?: 'light' | 'dark';
  javaScript?: boolean;
  widths?: number[];
  /** Scroll .os-phone-scroll to its end (behavior: instant) before shooting. */
  scrollHome?: true;
  /** Click the guide button for this app before shooting. */
  guide?: AppId;
};

const SHOTS: Shot[] = [
  { name: 'home-es', path: '/' },
  { name: 'home-ca', path: '/ca/' },
  { name: 'home-en', path: '/en/' },
  { name: 'home-es-night', path: '/', colorScheme: 'dark' },
  { name: 'home-ca-night', path: '/ca/', colorScheme: 'dark' },
  { name: 'home-en-night', path: '/en/', colorScheme: 'dark' },
  { name: 'phone-grid-es', path: '/', scrollHome: true, widths: [375] },
  { name: 'phone-grid-ca', path: '/ca/', scrollHome: true, widths: [375] },
  { name: 'phone-grid-en', path: '/en/', scrollHome: true, widths: [375] },
  { name: 'phone-projects-es', path: '/', guide: 'projects', widths: [375] },
  { name: 'phone-about-es', path: '/', phoneApp: 'about', widths: [375, 768] },
  { name: 'deeplink-questday-es', path: '/work/questday/', widths: [375, 1440] },
  { name: 'questday-es', path: '/work/questday/', widths: [1440] },
  { name: 'questday-es-night', path: '/work/questday/', colorScheme: 'dark', widths: [1440] },
  { name: 'rally-voley-ca', path: '/ca/work/rally-voley/', widths: [375, 1440] },
  { name: 'document-es', path: '/', javaScript: false, widths: [375, 1440] },
];

/** Waits for every image, lazy ones too, so none is caught blank. */
async function settleImages(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    const images = [...document.images];
    images.forEach((image) => (image.loading = 'eager'));
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  });
}

for (const shot of SHOTS) {
  for (const viewport of VIEWPORTS.filter((v) => !shot.widths || shot.widths.includes(v.width))) {
    test.describe(`${shot.name} at ${viewport.width}px`, () => {
      test.use({
        viewport,
        colorScheme: shot.colorScheme ?? 'light',
        javaScriptEnabled: shot.javaScript ?? true,
      });

      test('screenshot', async ({ page }) => {
        const response =
          shot.javaScript === false ? await page.goto(shot.path) : await visit(page, shot.path);
        expect(response!.status()).toBe(200);

        if (shot.guide) {
          // Click the guide button (welcome card) for that app.
          const btn = page.locator(`button[data-open-app="${shot.guide}"]`).first();
          await btn.click();
          await expect(win(page, shot.guide)).toBeVisible();
        } else if (shot.phoneApp) {
          await page.locator(`[data-phone-icon="${shot.phoneApp}"]`).click();
          await expect(win(page, shot.phoneApp)).toHaveAttribute('data-phone-active', 'true');
        }

        if (shot.scrollHome) {
          await page.locator('.os-phone-scroll').evaluate((el) => {
            el.scrollTo({ top: el.scrollHeight, behavior: 'instant' });
          });
          // Poll until two successive reads agree (Chromium smooth scroll).
          let prev = -1;
          for (let i = 0; i < 20; i++) {
            const cur: number = await page.locator('.os-phone-scroll').evaluate((el) => el.scrollTop);
            if (cur === prev) break;
            prev = cur;
            await page.waitForTimeout(50);
          }
        }

        await settleImages(page);
        await page.screenshot({
          path: `${DIR}/${shot.name}-${viewport.width}.png`,
          fullPage: true,
        });
      });
    });
  }
}

// ── Boot shots ────────────────────────────────────────────────────────────────
// These run with reducedMotion: 'no-preference' and use context.newPage() so
// the fixture's SKIP_BOOT_FLAG init script is never added.

test.describe('boot shots', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const colorScheme of ['light', 'dark'] as const) {
    const name = colorScheme === 'light' ? 'boot-es' : 'boot-es-night';

    for (const [width, height] of [
      [375, 812],
      [1440, 900],
    ]) {
      test.describe(`${name} at ${width}px`, () => {
        test.use({ colorScheme, viewport: { width, height } });

        test('screenshot', async ({ browser }) => {
          // Fresh context — no fixture page override, no boot-skip flag.
          const context = await browser.newContext({
            reducedMotion: 'no-preference',
            colorScheme,
            viewport: { width, height },
          });
          const page = await context.newPage();

          // Install a fake clock so the pre-paint timer never fires.
          await page.clock.install();
          await page.goto('/');

          // Pause all animations and seek to 1750 ms — the hint and the
          // first two lines are showing.
          await page.evaluate(() => {
            document.getAnimations().forEach((a) => {
              a.pause();
              (a as CSSAnimation).currentTime = 1750;
            });
          });

          await settleImages(page);
          await page.screenshot({
            path: `${DIR}/${name}-${width}.png`,
            fullPage: true,
          });

          await context.close();
        });
      });
    }
  }
});
