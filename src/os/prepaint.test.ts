import { describe, expect, it, vi } from 'vitest';
import { BOOT_MS } from './shell/boot-timing';
import { DESKTOP_QUERY, prepaintScript, SKIP_BOOT_FLAG, WALLPAPERS } from './prepaint';
import { PREF_KEYS } from './storage';

type Attrs = Record<string, string>;

/** Recorded listener entry. */
interface ListenerEntry {
  type: string;
  handler: (ev?: unknown) => void;
}

/** Recorded timer entry. */
interface TimerEntry {
  id: number;
  callback: (ev?: unknown) => void;
  delay: number;
}

interface StubDocEl {
  setAttribute(name: string, val: string): void;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
}

interface RunResult {
  attrs: Attrs;
  docEl: StubDocEl;
  listeners: ListenerEntry[];
  removedListeners: Array<{ type: string; handler: unknown }>;
  timers: TimerEntry[];
  clearedIds: number[];
}

/**
 * Run the prepaint IIFE against stub globals.
 * We pass `document` and `window` as named parameters so the inner IIFE
 * closes over them instead of looking at the (absent) Node globals.
 */
function run(
  winPartial: Partial<{
    matchMedia: (query: string) => { matches: boolean };
    localStorage: { getItem: (key: string) => string | null };
    setTimeout: (cb: (ev?: unknown) => void, ms: number) => number;
    clearTimeout: (id: number) => void;
    [key: string]: unknown;
  }> = {},
  script?: string,
): RunResult {
  const attrs: Attrs = {};
  const attrMap = new Map<string, string>();

  const docEl: StubDocEl = {
    setAttribute(name: string, val: string) {
      attrs[name] = val;
      attrMap.set(name, val);
    },
    removeAttribute(name: string) {
      delete attrs[name];
      attrMap.delete(name);
    },
    hasAttribute(name: string) {
      return attrMap.has(name);
    },
  };

  const listeners: ListenerEntry[] = [];
  const removedListeners: Array<{ type: string; handler: unknown }> = [];
  const timers: TimerEntry[] = [];
  const clearedIds: number[] = [];
  let nextTimerId = 1;

  const doc = {
    documentElement: docEl,
    addEventListener(type: string, handler: (ev?: unknown) => void) {
      listeners.push({ type, handler });
    },
    removeEventListener(type: string, handler: unknown) {
      removedListeners.push({ type, handler });
    },
  };

  const defaultWin = {
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null as string | null },
    setTimeout: (cb: (ev?: unknown) => void, ms: number) => {
      const id = nextTimerId++;
      timers.push({ id, callback: cb, delay: ms });
      return id;
    },
    clearTimeout: (id: number) => {
      clearedIds.push(id);
    },
  };

  const finalWin = { ...defaultWin, ...winPartial };

  const fn = new Function('document', 'window', script ?? prepaintScript());
  fn(doc, finalWin);

  return { attrs, docEl, listeners, removedListeners, timers, clearedIds };
}

function noStorage(): { getItem: (key: string) => string | null } {
  return { getItem: () => null };
}

// ---------------------------------------------------------------------------
describe('prepaintScript', () => {
  it('desktop when the query matches, phone otherwise', () => {
    const desktop = run({
      matchMedia: (q) => ({ matches: q === DESKTOP_QUERY }),
      localStorage: noStorage(),
    });
    expect(desktop.attrs['data-os']).toBe('desktop');

    const phone = run({
      matchMedia: () => ({ matches: false }),
      localStorage: noStorage(),
    });
    expect(phone.attrs['data-os']).toBe('phone');
  });

  it('defaults data-os to desktop when matchMedia is missing', () => {
    const result = run({
      matchMedia: () => { throw new Error('matchMedia unavailable'); },
      localStorage: noStorage(),
    });
    expect(result.attrs['data-os']).toBe('desktop');
  });

  it('stored wallpaper is applied; unknown values fall back to dots', () => {
    for (const wp of WALLPAPERS) {
      const result = run({
        matchMedia: () => ({ matches: false }),
        localStorage: { getItem: (k) => (k === PREF_KEYS.wallpaper ? wp : null) },
      });
      expect(result.attrs['data-wallpaper']).toBe(wp);
    }

    const unknown = run({
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (k) => (k === PREF_KEYS.wallpaper ? 'neon' : null) },
    });
    expect(unknown.attrs['data-wallpaper']).toBe('dots');
  });

  it('data-theme only for light/dark', () => {
    for (const theme of ['light', 'dark'] as const) {
      const result = run({
        matchMedia: () => ({ matches: false }),
        localStorage: { getItem: (k) => (k === PREF_KEYS.theme ? theme : null) },
      });
      expect(result.attrs['data-theme']).toBe(theme);
    }

    const invalid = run({
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (k) => (k === PREF_KEYS.theme ? 'purple' : null) },
    });
    expect(invalid.attrs['data-theme']).toBeUndefined();

    const noTheme = run({
      matchMedia: () => ({ matches: false }),
      localStorage: noStorage(),
    });
    expect(noTheme.attrs['data-theme']).toBeUndefined();
  });

  it('boots on every load without reduced motion, a returning visitor too', () => {
    // No reduced motion → data-boot=1
    const firstVisit = run({
      matchMedia: () => ({ matches: false }),
      localStorage: noStorage(),
    });
    expect(firstVisit.attrs['data-boot']).toBe('1');

    // A returning visitor — jgos-booted is set but no longer checked
    const alreadyBooted = run({
      matchMedia: () => ({ matches: false }),
      localStorage: { getItem: (k) => (k === 'jgos-booted' ? '1' : null) },
    });
    expect(alreadyBooted.attrs['data-boot']).toBe('1');

    // Reduced motion active → no data-boot even on every load
    const reducedMotion = run({
      matchMedia: (q) => ({ matches: q.includes('reduced-motion') }),
      localStorage: noStorage(),
    });
    expect(reducedMotion.attrs['data-boot']).toBeUndefined();
  });

  it('survives throwing storage: data-os set, data-wallpaper=dots, the boot still runs, no throw', () => {
    let result!: RunResult;
    expect(() => {
      result = run({
        matchMedia: (q) => ({ matches: q === DESKTOP_QUERY }),
        localStorage: {
          getItem: () => { throw new Error('storage denied'); },
        },
      });
    }).not.toThrow();

    expect(result.attrs['data-os']).toBe('desktop');
    expect(result.attrs['data-wallpaper']).toBe('dots');
    expect(result.attrs['data-boot']).toBe('1');
  });

  it('a key or a click ends the boot at once; left alone, it ends after BOOT_MS', () => {
    // --- The timer is scheduled for BOOT_MS ---
    {
      const r = run();
      expect(r.attrs['data-boot']).toBe('1');
      expect(r.timers.length).toBe(1);
      expect(r.timers[0].delay).toBe(BOOT_MS);
    }

    // --- keydown: removes data-boot, both listeners, clears the timer ---
    {
      const r = run();
      expect(r.docEl.hasAttribute('data-boot')).toBe(true);
      const keydownHandler = r.listeners.find((l) => l.type === 'keydown')!.handler;
      expect(keydownHandler).toBeDefined();
      keydownHandler(); // simulate keydown with no event arg
      expect(r.docEl.hasAttribute('data-boot')).toBe(false);
      expect(r.removedListeners).toHaveLength(2);
      expect(r.removedListeners.map((l) => l.type).sort()).toEqual(['click', 'keydown']);
      expect(r.clearedIds).toHaveLength(1);
      expect(r.clearedIds[0]).toBe(r.timers[0].id);
    }

    // --- click on the boot screen itself: cancels the event ---
    {
      const r = run();
      const clickHandler = r.listeners.find((l) => l.type === 'click')!.handler;
      expect(clickHandler).toBeDefined();
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      // Target is inside [data-boot-screen]: closest returns a truthy sentinel.
      const target = { closest: (sel: string) => sel === '[data-boot-screen]' ? {} : null };
      clickHandler({ type: 'click', target, preventDefault, stopPropagation });
      expect(r.docEl.hasAttribute('data-boot')).toBe(false);
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(stopPropagation).toHaveBeenCalledOnce();
    }

    // --- click on a control outside the boot screen: ends boot, does not cancel ---
    {
      const r = run();
      const clickHandler = r.listeners.find((l) => l.type === 'click')!.handler;
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      // Target is NOT inside [data-boot-screen]: closest returns null.
      const target = { closest: (_sel: string) => null };
      clickHandler({ type: 'click', target, preventDefault, stopPropagation });
      expect(r.docEl.hasAttribute('data-boot')).toBe(false);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopPropagation).not.toHaveBeenCalled();
    }

    // --- timer callback: removes data-boot ---
    {
      const r = run();
      r.timers[0].callback();
      expect(r.docEl.hasAttribute('data-boot')).toBe(false);
    }
  });

  it('an e2e build skips the boot when the test flag is set; a deploy build ignores it', () => {
    // e2e=true + flag set → no data-boot
    const e2eWithFlag = run(
      { [SKIP_BOOT_FLAG]: true },
      prepaintScript({ e2e: true }),
    );
    expect(e2eWithFlag.attrs['data-boot']).toBeUndefined();

    // e2e=false + flag set → data-boot='1' (flag check not emitted)
    const deployWithFlag = run(
      { [SKIP_BOOT_FLAG]: true },
      prepaintScript({ e2e: false }),
    );
    expect(deployWithFlag.attrs['data-boot']).toBe('1');
  });
});
