import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { themeColor, themeColorDark } from './theme-color';

/*
 * Parses os-tokens.css into two flat token maps: day (the :root block) and
 * night (the :root[data-theme="dark"] explicit-override block).
 * Both must have the seven theme-sensitive tokens; the dark block need not
 * repeat the app colours or geometry that never change.
 */
const css = readFileSync(fileURLToPath(new URL('./os-tokens.css', import.meta.url)), 'utf8');

function parseBlock(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]),
  );
}

// Day: the first bare :root { ... } — no nesting inside, so [^}]* is safe.
const dayRaw = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
const day = parseBlock(dayRaw);

// Night: the explicit :root[data-theme="dark"] { ... } override block.
const nightRaw = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] ?? '';
const night = parseBlock(nightRaw);

// Cream: the one light wallpaper overrides the icon label colours.
const creamRaw = css.match(/html\[data-wallpaper="cream"\]\s*\{([^}]*)\}/)?.[1] ?? '';
const cream = parseBlock(creamRaw);

// ── Helpers ─────────────────────────────────────────────────────────────────

const luminance = (hex: string) => {
  const channels = hex.replace('#', '').match(/../g)!.map((c) => parseInt(c, 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── Token lists ──────────────────────────────────────────────────────────────

/** Tokens that must exist in BOTH themes (day defaults + night overrides). */
const DAY_AND_NIGHT = [
  '--os-desk',
  '--os-window',
  '--os-ink',
  '--os-border',
  '--os-shadow',
] as const;

/**
 * App colours used as window titlebar fills.
 * Light colours use #111111 as text; grey (#5c6069) uses #ede7d9 as text.
 * All pairs must pass AA (os-tokens.test.ts asserts this).
 */
const LIGHT_APP_COLOURS = [
  '#ffd84d', // yellow
  '#f2a7c3', // pink
  '#b6e36b', // green
  '#9db8ff', // blue
  '#c9b8ff', // lilac
  '#ffb38a', // peach
  '#9de0ad', // mint
  '#a9dcf2', // sky
  '#f4ecd2', // cream
] as const;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('os-tokens', () => {
  test('defines every OS token in day and night', () => {
    for (const name of DAY_AND_NIGHT) {
      expect(day[name], `day missing ${name}`).toBeTruthy();
      expect(night[name], `night missing ${name}`).toBeTruthy();
    }
  });

  test('body text contrast ≥ 4.5', () => {
    expect(contrast(day['--os-ink'], day['--os-window'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(night['--os-ink'], night['--os-window'])).toBeGreaterThanOrEqual(4.5);
  });

  test('titlebar text on every app colour ≥ 4.5', () => {
    // Light colours: dark text (#111111) on light background.
    for (const c of LIGHT_APP_COLOURS) {
      expect(contrast('#111111', c), `#111111 on ${c}`).toBeGreaterThanOrEqual(4.5);
    }
    // grey: light text (#ede7d9) on grey background (#5c6069). Contrast is 5.1:1.
    expect(contrast('#ede7d9', '#5c6069'), '#ede7d9 on grey (#5c6069)').toBeGreaterThanOrEqual(4.5);
    // Verify grey and its foreground are defined in the token file.
    expect(day['--os-c-grey'], '--os-c-grey').toBe('#5c6069');
    expect(day['--os-c-grey-fg'], '--os-c-grey-fg').toBe('#ede7d9');
  });

  // Icon labels sit straight on the wallpaper, drawn with a 1 px outline (a
  // halo). WCAG measures outlined text against its halo, so ink on halo must
  // pass on every wallpaper, whatever it shows behind.
  test('icon labels: ink on its outline ≥ 4.5, on dark wallpapers and on cream', () => {
    expect(contrast(day['--os-icon-ink'], day['--os-icon-halo']), 'dark wallpapers').toBeGreaterThanOrEqual(4.5);
    expect(contrast(cream['--os-icon-ink'], cream['--os-icon-halo']), 'cream').toBeGreaterThanOrEqual(4.5);
    // The colours follow the wallpaper, not the theme: night must not override them.
    expect(night['--os-icon-ink']).toBeUndefined();
    expect(night['--os-icon-halo']).toBeUndefined();
  });

  test('theme colours equal the desk colours', () => {
    expect(themeColor).toBe(day['--os-desk']);
    expect(themeColorDark).toBe(night['--os-desk']);
  });
});
