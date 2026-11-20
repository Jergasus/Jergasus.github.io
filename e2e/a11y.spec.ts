import AxeBuilder from '@axe-core/playwright';
import { expect, test, visit } from './fixtures';
import { ALL_PAGES } from './pages';

// Quality gate (spec §5): axe finds no WCAG 2.0 A/AA or 2.1 AA violation on
// any page, scanned as the desktop a visitor lands on (hydrated, with the
// windows open on load), with reduced motion so nothing is mid-animation.
test.use({ reducedMotion: 'reduce' });

for (const path of ALL_PAGES) {
  test(`no axe violations (${path})`, async ({ page }) => {
    const response = await visit(page, path);
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
