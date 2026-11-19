import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { themeColor } from './theme-color';

// tokens.css is the swappable style contract (spec §5.1). These tests pin the
// names later tasks consume and the few values the plan fixes, so a new token
// file can replace this one without silently breaking components.
const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
const tokens = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const REM = 16;
const sumTerms = (expr: string, viewport: number) =>
  [...expr.matchAll(/([+-]?)\s*([\d.]+)(rem|vw|px)/g)].reduce((total, [, sign, n, unit]) => {
    const px = unit === 'rem' ? +n * REM : unit === 'vw' ? (+n * viewport) / 100 : +n;
    return total + (sign === '-' ? -px : px);
  }, 0);
const toPx = (name: string, viewport: number) => {
  const value = tokens.get(name) ?? '';
  const clamp = value.match(/^clamp\((.+),(.+),(.+)\)$/);
  if (!clamp) return sumTerms(value, viewport);
  const [min, preferred, max] = clamp.slice(1).map((part) => sumTerms(part, viewport));
  return Math.min(Math.max(preferred, min), max);
};

const luminance = (hex: string) => {
  const channels = hex.replace('#', '').match(/../g)!.map((c) => parseInt(c, 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const color = (name: string) => {
  const value = tokens.get(name) ?? '';
  expect(value, `${name} must be a #rrggbb hex`).toMatch(/^#[0-9a-f]{6}$/i);
  return value;
};

const STEPS = ['--step--1', '--step-0', '--step-1', '--step-2', '--step-3', '--step-4', '--step-5', '--step-6'];

describe('design tokens', () => {
  it('declares every contract token', () => {
    const contract = [
      '--color-paper', '--color-ink', '--color-ink-muted', '--color-rule', '--color-accent', '--color-accent-ink',
      '--color-activity-0', '--color-activity-1', '--color-activity-2', '--color-activity-3', '--color-activity-4',
      ...STEPS,
      '--step-poster',
      '--space-3xs', '--space-2xs', '--space-xs', '--space-s', '--space-m', '--space-l', '--space-xl', '--space-2xl', '--space-3xl',
      '--rule-width', '--container', '--gutter',
      '--photo-filter', '--photo-max',
      '--ease-out', '--duration-ui', '--duration-page',
    ];
    expect(contract.filter((name) => !tokens.has(name))).toEqual([]);
  });

  it('about photo is readable on a phone and fits its content width', () => {
    const photo = toPx('--photo-max', 375);
    expect(photo).toBeGreaterThanOrEqual(200);
    expect(photo).toBeLessThanOrEqual(375 - 2 * toPx('--gutter', 375));
  });

  it('gutter is 16px at 375px', () => {
    expect(toPx('--gutter', 375)).toBeCloseTo(16, 1);
  });

  it('type scale ascends and the top step is about 12vw at 1440px', () => {
    for (const viewport of [375, 768, 1440]) {
      const sizes = STEPS.map((step) => toPx(step, viewport));
      expect(sizes, `ascending at ${viewport}px`).toEqual([...sizes].sort((a, b) => a - b));
      expect(new Set(sizes).size).toBe(sizes.length);
    }
    expect(toPx('--step-0', 375)).toBeGreaterThanOrEqual(16);
    expect(toPx('--step-6', 1440) / 1440).toBeCloseTo(0.12, 2);
  });

  it('colours meet WCAG AA on paper', () => {
    const paper = color('--color-paper');
    expect(contrast(color('--color-ink'), paper)).toBeGreaterThanOrEqual(7);
    expect(contrast(color('--color-ink-muted'), paper)).toBeGreaterThanOrEqual(4.5);
    // The accent is also set as text (hovers, the 404 link), not only as a
    // fill, so it needs the text ratio, not the 3:1 for large text and UI.
    expect(contrast(color('--color-accent'), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('--color-accent-ink'), color('--color-accent'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the browser chrome takes the paper colour', () => {
    // CSS cannot reach <meta name="theme-color">, so theme-color.ts holds a
    // copy of the paper colour; it has to follow tokens.css.
    expect(themeColor.toLowerCase()).toBe(color('--color-paper').toLowerCase());
  });

  it('the site icon is drawn in the paper, ink and accent', () => {
    // src/app/icon.svg cannot read CSS variables, so it carries hex copies.
    const icon = readFileSync(fileURLToPath(new URL('../app/icon.svg', import.meta.url)), 'utf8');
    const used = new Set([...icon.matchAll(/#[0-9a-f]{6}\b/gi)].map(([hex]) => hex.toLowerCase()));
    const palette = ['--color-paper', '--color-ink', '--color-accent'].map((name) => color(name).toLowerCase());
    expect([...used].sort()).toEqual([...palette].sort());
  });
});
