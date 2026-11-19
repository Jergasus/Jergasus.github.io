import { afterEach, describe, expect, it, vi } from 'vitest';
import { motion, prefersReducedMotion, previewFollow } from './motion';

describe('motion presets', () => {
  it('durations are ascending and under 1.2s', () => {
    const { fast, base, slow } = motion.duration;
    expect(fast).toBeGreaterThan(0);
    expect(fast).toBeLessThan(base);
    expect(base).toBeLessThan(slow);
    expect(slow).toBeLessThanOrEqual(1.2);
  });

  it('preview lerp in (0,1]', () => {
    expect(previewFollow.lerp).toBeGreaterThan(0);
    expect(previewFollow.lerp).toBeLessThanOrEqual(1);
  });

  it('eases are GSAP ease names', () => {
    const gsapEase = /^(power[1-4]|expo|circ|sine)\.(in|out|inOut)$/;
    expect(motion.ease.out).toMatch(gsapEase);
    expect(motion.ease.inOut).toMatch(gsapEase);
  });

  it('staggers are shorter than the fastest duration', () => {
    expect(motion.stagger.rows).toBeGreaterThan(0);
    expect(motion.stagger.lines).toBeGreaterThan(0);
    expect(motion.stagger.rows).toBeLessThan(motion.duration.fast);
    expect(motion.stagger.lines).toBeLessThan(motion.duration.fast);
  });

  it('page-load beats overlap in order: rules, lines, content, rows', () => {
    const { lines, content, rows } = motion.load;
    expect(lines).toBeGreaterThan(0);
    expect(lines).toBeLessThan(content);
    expect(content).toBeLessThan(rows);
    // Each beat starts before the one it follows has settled, so the
    // sequence reads as one gesture rather than four.
    expect(lines).toBeLessThan(motion.duration.base);
    expect(content).toBeLessThan(lines + motion.duration.slow);
  });

  it('the page-load sequence only starts close to the first paint', () => {
    // Later than this, the visitor has already seen the page in place.
    expect(motion.load.latest).toBeGreaterThan(0);
    expect(motion.load.latest).toBeLessThanOrEqual(0.2);
  });

  it('the page-load sequence settles well inside 2.5s', () => {
    // Four index rows, staggered, are the last thing to land (e2e budget: 2.5s).
    const end = motion.load.rows + 3 * motion.stagger.rows + motion.duration.fast;
    expect(end).toBeLessThanOrEqual(2);
  });

  it('scroll reveals start inside the viewport and items follow the heading', () => {
    expect(motion.reveal.at).toBeGreaterThan(0.5);
    expect(motion.reveal.at).toBeLessThanOrEqual(1);
    expect(motion.reveal.items).toBeGreaterThan(0);
    expect(motion.reveal.items).toBeLessThan(motion.duration.base);
  });

  it('items settle over a short distance', () => {
    expect(motion.settle).toBeGreaterThan(0);
    expect(motion.settle).toBeLessThanOrEqual(24);
  });
});

describe('prefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the prefers-reduced-motion media query', () => {
    const matchMedia = vi.fn((query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    vi.stubGlobal('window', { matchMedia });
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(prefersReducedMotion()).toBe(false);
  });

  it('treats an environment without matchMedia as reduced motion', () => {
    vi.stubGlobal('window', undefined);
    expect(prefersReducedMotion()).toBe(true);
  });
});
