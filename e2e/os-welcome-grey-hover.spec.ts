/**
 * TDD: grey guide-button hover & focus-visible feedback
 * Write RED (button is grey before hover, cream on hover, ink outline on focus).
 *
 * Round 2 fix: focus ring was cream on a cream window → invisible in light theme.
 * Fix: outline-color: var(--os-ink) scoped to the welcome window/phone card.
 */
import { expect, test, visit, win } from './fixtures';

const GREY = 'rgb(92, 96, 105)';
const CREAM = 'rgb(237, 231, 217)';
const INK_LIGHT = 'rgb(17, 17, 17)'; // --os-ink in light theme

const BUTTON = (page: Parameters<typeof win>[0]) =>
  win(page, 'welcome')
    .locator('[data-welcome-part="actions"] button[data-open-app="projects"]');

function contrastRatio(c1: string, c2: string): number {
  const parse = (c: string) => c.match(/\d+(\.\d+)?/g)!.map(Number);
  const lum = ([r, g, b]: number[]) => {
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [l1, l2] = [lum(parse(c1)), lum(parse(c2))];
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Hover: background must invert to cream (#ede7d9)
// ---------------------------------------------------------------------------

test('grey guide button: hover inverts background to cream', async ({ page }) => {
  await visit(page, '/');
  const btn = BUTTON(page);

  // Normal state: grey background
  await expect(btn).toHaveCSS('background-color', GREY);

  await btn.hover();

  // Hovered state: cream (#ede7d9 = rgb(237, 231, 217))
  await expect(btn).toHaveCSS('background-color', CREAM);
});

// ---------------------------------------------------------------------------
// Focus-visible: outline must be dashed ink (not cream) on a grey button.
// Using currentColor on a grey button resolves to cream (--app-fg), which
// is the same as the window background — invisible. The fix pins it to
// --os-ink so it always contrasts with the cream/dark window.
// ---------------------------------------------------------------------------

test('grey guide button: focus-visible shows a dashed ink outline', async ({ page }) => {
  await visit(page, '/');
  const btn = BUTTON(page);

  await btn.focus();

  await expect(btn).toHaveCSS('outline-style', 'dashed');
  // outline-color must be --os-ink (#111111 in light = rgb(17, 17, 17))
  await expect(btn).toHaveCSS('outline-color', INK_LIGHT);
});

// ---------------------------------------------------------------------------
// A11y: focus ring must contrast ≥ 3:1 with the window background (1280×720).
// Before the fix, currentColor = cream = window bg → contrast 1:1 → invisible.
// After the fix, --os-ink contrasts ≥ 10:1 with the cream/dark window.
// ---------------------------------------------------------------------------

for (const theme of [undefined, 'dark'] as const) {
  test(`desktop welcome guide button focus ring contrasts ≥ 3:1 with window bg (${theme ?? 'light'})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await visit(page, '/');
    if (theme === 'dark') {
      await page.evaluate(() =>
        document.documentElement.setAttribute('data-theme', 'dark'),
      );
    }

    // Use Playwright's locator.focus() — triggers :focus-visible via CDP.
    // Read computed styles via locator.evaluate() which preserves the focus state.
    const btn = BUTTON(page);
    await btn.focus();

    const outlineColor = await btn.evaluate(
      (el) => getComputedStyle(el).outlineColor,
    );
    const windowBg = await page
      .locator('[data-app="welcome"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(contrastRatio(outlineColor, windowBg)).toBeGreaterThanOrEqual(3);
  });
}
