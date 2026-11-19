import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { ALL_PAGES } from './pages';

// Quality gate (spec §6): axe finds no WCAG 2.0 A/AA or 2.1 AA violation on
// any page. Scanned with reduced motion so every section is in its settled,
// static state: content a scroll reveal still holds back (opacity 0) would
// otherwise be skipped by the contrast check instead of measured.
test.use({ reducedMotion: 'reduce' });

for (const path of ALL_PAGES) {
  test(`no axe violations (${path})`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response!.status()).toBe(200);
    await page.evaluate(() => document.fonts.ready);

    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    // One line per failing node, so a failure names what to fix.
    const report = violations.flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`),
    );
    expect(report).toEqual([]);
  });
}
