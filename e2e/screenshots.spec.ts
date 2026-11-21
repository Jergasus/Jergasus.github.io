import type { Page } from '@playwright/test';
import type { AppId } from '@/os/apps';
import { expect, test, visit, win } from './fixtures';

// Visual QA (spec §6): screenshots to read, not to diff, at 375, 768 and
// 1440 px. Taken with reduced motion so nothing is caught mid-animation.
// Written to test-results/screens/ (gitignored, cleared by every run), or to
// SCREENS_DIR when set. Below 64 rem the site is the phone, so 375 and 768
// show the phone home and its apps; 1440 shows the desktop.
test.use({ reducedMotion: 'reduce' });

const DIR = process.env.SCREENS_DIR ?? 'test-results/screens';

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

type Shot = {
  name: string;
  path: string;
  /** A phone app to open from its home-screen icon first. */
  phoneApp?: AppId;
  colorScheme?: 'light' | 'dark';
  javaScript?: boolean;
  widths?: number[];
};

const SHOTS: Shot[] = [
  { name: 'home-es', path: '/' },
  { name: 'home-en', path: '/en/' },
  { name: 'questday-es', path: '/work/questday/' },
  { name: 'rally-voley-ca', path: '/ca/work/rally-voley/', widths: [375, 1440] },
  { name: 'home-es-night', path: '/', colorScheme: 'dark' },
  { name: 'questday-es-night', path: '/work/questday/', colorScheme: 'dark', widths: [375, 1440] },
  { name: 'phone-about', path: '/', phoneApp: 'about', widths: [375, 768] },
  { name: 'phone-business', path: '/', phoneApp: 'business', widths: [375, 768] },
  { name: 'phone-terminal', path: '/', phoneApp: 'terminal', widths: [375] },
  { name: 'phone-activity-night', path: '/', phoneApp: 'activity', colorScheme: 'dark', widths: [375] },
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
        const response = shot.javaScript === false ? await page.goto(shot.path) : await visit(page, shot.path);
        expect(response!.status()).toBe(200);
        if (shot.phoneApp) {
          await page.locator(`[data-phone-icon="${shot.phoneApp}"]`).click();
          await expect(win(page, shot.phoneApp)).toHaveAttribute('data-phone-active', 'true');
        }
        await settleImages(page);
        await page.screenshot({ path: `${DIR}/${shot.name}-${viewport.width}.png`, fullPage: true });
      });
    });
  }
}
