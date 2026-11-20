import { expect, test } from './fixtures';

// Visual QA (spec §6): full-page screenshots to read, not to diff. Taken with
// reduced motion so scroll reveals are in place instead of held back below
// the fold. Written to test-results/screens/ (gitignored); Playwright clears
// test-results/ at the start of every run, so re-run this spec to refresh them.
test.use({ reducedMotion: 'reduce' });

const PAGES = [
  { name: 'home-es', path: '/' },
  { name: 'home-en', path: '/en/' },
  { name: 'questday-es', path: '/work/questday/' },
];

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

for (const { name, path } of PAGES) {
  for (const viewport of VIEWPORTS) {
    test(`screenshot ${name} at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto(path);
      expect(response!.status()).toBe(200);
      await page.evaluate(() => document.fonts.ready);
      // Lazy images below the fold load as the full-page capture reaches them;
      // wait for every one so none is caught blank.
      await page.evaluate(async () => {
        const images = [...document.images];
        images.forEach((image) => (image.loading = 'eager'));
        await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
      });
      await page.screenshot({
        path: `test-results/screens/${name}-${viewport.width}.png`,
        fullPage: true,
      });
    });
  }
}
