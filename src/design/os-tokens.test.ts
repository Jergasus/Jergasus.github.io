import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { osThemeColor, osThemeColorDark } from './theme-color';

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
  '--os-label-bg',
  '--os-label-ink',
] as const;

/**
 * App colours used as window titlebar fills.
 * Text colour on these is always #111111 (brief §title-bar); all must pass AA.
 * Icon-label chips are NOT on the wallpaper — they sit on --os-label-bg,
 * which provides a neutral surface that meets 4.5:1 regardless of wallpaper.
 */
const APP_COLOURS = [
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
    for (const c of APP_COLOURS) {
      expect(contrast('#111111', c), `#111111 on ${c}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('icon labels use the label chip, ≥ 4.5 in both themes', () => {
    expect(
      contrast(day['--os-label-ink'], day['--os-label-bg']),
      'day label chip',
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(night['--os-label-ink'], night['--os-label-bg']),
      'night label chip',
    ).toBeGreaterThanOrEqual(4.5);
  });

  test('theme colours equal the desk colours', () => {
    expect(osThemeColor).toBe(day['--os-desk']);
    expect(osThemeColorDark).toBe(night['--os-desk']);
  });
});
