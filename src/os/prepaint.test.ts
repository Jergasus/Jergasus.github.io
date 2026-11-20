import { describe, expect, it } from 'vitest';
import { DESKTOP_QUERY, prepaintScript, WALLPAPERS } from './prepaint';
import { PREF_KEYS } from './storage';

type Attrs = Record<string, string>;

/** Stubs for the browser globals the IIFE reads. */
interface StubWindow {
  matchMedia: (query: string) => { matches: boolean };
  localStorage: { getItem: (key: string) => string | null };
}

/**
 * Run the prepaint IIFE against stub globals.
 * We pass `document` and `window` as named parameters so the inner IIFE
 * closes over them instead of looking at the (absent) Node globals.
 */
function run(win: StubWindow): Attrs {
  const attrs: Attrs = {};
  const doc = {
    documentElement: {
      setAttribute(name: string, val: string) {
        attrs[name] = val;
      },
    },
  };
  // new Function('document', 'window', body) → the IIFE closes over the params
  const fn = new Function('document', 'window', prepaintScript());
  fn(doc, win);
  return attrs;
}

function noStorage(): StubWindow['localStorage'] {
  return { getItem: () => null };
}

// ---------------------------------------------------------------------------
describe('prepaintScript', () => {
  it('desktop when the query matches, phone otherwise', () => {
    const desktop = run({
      matchMedia: (q) => ({ matches: q === DESKTOP_QUERY }),
      localStorage: noStorage(),
    });
    expect(desktop['data-os']).toBe('desktop');

    const phone = run({
      matchMedia: () => ({ matches: false }),
      localStorage: noStorage(),
    });
    expect(phone['data-os']).toBe('phone');
  });

  it('defaults data-os to desktop when matchMedia is missing', () => {
    const attrs = run({
      matchMedia: () => { throw new Error('matchMedia unavailable'); },
      localStorage: noStorage(),
    });
    expect(attrs['data-os']).toBe('desktop');
  });

  it('stored wallpaper is applied; unknown values fall back to dots', () => {
    for (const wp of WALLPAPERS) {
      const attrs = run({
        matchMedia: () => ({ matches: false }),
        localStorage: { getItem: (k) => (k === PREF_KEYS.wallpaper ? wp : null) },
      });
      expect(attrs['data-wallpaper']).toBe(wp);
    }

    const unknown = run({
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (k) => (k === PREF_KEYS.wallpaper ? 'neon' : null) },
    });
    expect(unknown['data-wallpaper']).toBe('dots');
  });

  it('data-theme only for light/dark', () => {
    for (const theme of ['light', 'dark'] as const) {
      const attrs = run({
        matchMedia: () => ({ matches: false }),
        localStorage: { getItem: (k) => (k === PREF_KEYS.theme ? theme : null) },
      });
      expect(attrs['data-theme']).toBe(theme);
    }

    const invalid = run({
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (k) => (k === PREF_KEYS.theme ? 'purple' : null) },
    });
    expect(invalid['data-theme']).toBeUndefined();

    const noTheme = run({
      matchMedia: () => ({ matches: false }),
      localStorage: noStorage(),
    });
    expect(noTheme['data-theme']).toBeUndefined();
  });

  it('boot only on a first visit without reduced motion', () => {
    // First visit (booted not set) + no reduced motion → data-boot=1
    const firstVisit = run({
      matchMedia: () => ({ matches: false }),
      localStorage: noStorage(),
    });
    expect(firstVisit['data-boot']).toBe('1');

    // Already booted → no data-boot
    const alreadyBooted = run({
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (k) => (k === PREF_KEYS.booted ? '1' : null) },
    });
    expect(alreadyBooted['data-boot']).toBeUndefined();

    // Reduced motion active → no data-boot even on first visit
    const reducedMotion = run({
      matchMedia: (q) => ({ matches: q.includes('reduced-motion') }),
      localStorage: noStorage(),
    });
    expect(reducedMotion['data-boot']).toBeUndefined();
  });

  it('survives throwing storage: data-os set, data-wallpaper=dots, no data-boot, no throw', () => {
    let attrs: Attrs = {};
    expect(() => {
      attrs = run({
        matchMedia: (q) => ({ matches: q === DESKTOP_QUERY }),
        localStorage: {
          getItem: () => { throw new Error('storage denied'); },
        },
      });
    }).not.toThrow();

    expect(attrs['data-os']).toBe('desktop');
    expect(attrs['data-wallpaper']).toBe('dots');
    expect(attrs['data-boot']).toBeUndefined();
  });
});
