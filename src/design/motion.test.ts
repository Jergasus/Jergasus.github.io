import { afterEach, describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import * as presets from './motion';
import { motion, prefersReducedMotion } from './motion';

describe('JG-OS motion presets', () => {
  const { open, close, minimize, phoneApp, toast, bootLine } = motion.os;
  const sequences = { open, close, minimize, phoneApp, toast };

  it('durations ascend from the quickest exit to the springy phone app, and stay snappy', () => {
    // Leaving is quicker than arriving; the phone app, which travels the
    // furthest (icon to full screen) and overshoots, gets the longest beat.
    const ascending = [close, minimize, open, toast, phoneApp].map(({ duration }) => duration);
    expect(ascending[0]).toBeGreaterThan(0);
    for (let i = 1; i < ascending.length; i++) expect(ascending[i]).toBeGreaterThan(ascending[i - 1]);
    // Snappy and retro, never slow or floaty.
    expect(ascending.at(-1)).toBeLessThanOrEqual(0.35);
  });

  it('eases are GSAP ease names', () => {
    const gsapEase = /^(none|(power[1-4]|expo|circ|sine)\.(in|out|inOut)|back\.(in|out|inOut)\(\d+(\.\d+)?\))$/;
    for (const [name, { ease }] of Object.entries(sequences)) {
      expect(ease, name).toMatch(gsapEase);
      // GSAP itself reads it as a curve from 0 to 1 (a typo would not).
      const curve = gsap.parseEase(ease);
      expect(curve(0), name).toBeCloseTo(0);
      expect(curve(1), name).toBeCloseTo(1);
    }
  });

  it('arrivals ease out, the exit eases in, the trip to the taskbar eases both ways', () => {
    for (const { ease } of [open, phoneApp, toast]) expect(ease).toMatch(/\.out\b/);
    expect(close.ease).toMatch(/\.in$/);
    expect(minimize.ease).toMatch(/\.inOut$/);
  });

  it('the boot prints its four lines and the skip hint in about a second', () => {
    // Five beats: line 1 on the first paint, then one per step (BootScreen.tsx).
    expect(bootLine).toBeGreaterThan(0);
    expect(5 * bootLine).toBeGreaterThanOrEqual(0.8);
    expect(5 * bootLine).toBeLessThanOrEqual(1.2);
  });

  it('holds only the JG-OS presets (the v1 values are gone)', () => {
    expect(Object.keys(presets).sort()).toEqual(['REDUCED_MOTION', 'motion', 'prefersReducedMotion']);
    expect(Object.keys(motion)).toEqual(['os']);
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
