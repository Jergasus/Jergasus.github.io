import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPref, readSession, writePref, writeSession } from './storage';

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeLS(initial: Record<string, string> = {}): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
  _store: Map<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    _store: store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
    removeItem: (k) => { store.delete(k); },
  };
}

function makeSS(initial: Record<string, string> = {}): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  _store: Map<string, string>;
} {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    _store: store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v); },
  };
}

// ---------------------------------------------------------------------------
describe('readPref', () => {
  it('returns null when window is undefined (SSR)', () => {
    // In the node test environment, window is not defined
    expect(typeof window).toBe('undefined');
    expect(readPref('jgos-booted')).toBe(null);
  });

  it('returns stored value via window.localStorage', () => {
    const ls = makeLS({ 'jgos-theme': 'dark' });
    vi.stubGlobal('window', { localStorage: ls });
    expect(readPref('jgos-theme')).toBe('dark');
  });

  it('returns null for a key that is not in storage', () => {
    const ls = makeLS();
    vi.stubGlobal('window', { localStorage: ls });
    expect(readPref('jgos-booted')).toBe(null);
  });

  it('returns null and writePref is silent when storage throws', () => {
    const throwing = {
      getItem: () => { throw new Error('storage denied'); },
      setItem: () => { throw new Error('storage denied'); },
      removeItem: () => { throw new Error('storage denied'); },
    };
    vi.stubGlobal('window', { localStorage: throwing, sessionStorage: throwing });
    expect(() => readPref('jgos-booted')).not.toThrow();
    expect(readPref('jgos-booted')).toBe(null);
    expect(() => writePref('jgos-booted', '1')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe('writePref', () => {
  it('is silent when window is undefined (SSR)', () => {
    expect(() => writePref('jgos-theme', 'light')).not.toThrow();
  });

  it('writes a string value to localStorage', () => {
    const ls = makeLS();
    vi.stubGlobal('window', { localStorage: ls });
    writePref('jgos-theme', 'light');
    expect(ls._store.get('jgos-theme')).toBe('light');
  });

  it('removes the key when value is null', () => {
    const ls = makeLS({ 'jgos-theme': 'dark' });
    vi.stubGlobal('window', { localStorage: ls });
    writePref('jgos-theme', null);
    expect(ls._store.has('jgos-theme')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('readSession', () => {
  it('returns null when window is undefined (SSR)', () => {
    expect(readSession('jgos-windows')).toBe(null);
  });

  it('parses JSON from sessionStorage', () => {
    const ss = makeSS({ 'jgos-windows': JSON.stringify({ about: { open: true } }) });
    vi.stubGlobal('window', { sessionStorage: ss });
    expect(readSession<{ about: { open: boolean } }>('jgos-windows')).toEqual({ about: { open: true } });
  });

  it('returns null when the key is not in sessionStorage', () => {
    const ss = makeSS();
    vi.stubGlobal('window', { sessionStorage: ss });
    expect(readSession('jgos-windows')).toBe(null);
  });

  it('returns null when JSON is malformed', () => {
    const ss = makeSS({ 'jgos-windows': 'not-json{{{' });
    vi.stubGlobal('window', { sessionStorage: ss });
    expect(readSession('jgos-windows')).toBe(null);
  });
});

// ---------------------------------------------------------------------------
describe('writeSession', () => {
  it('is silent when window is undefined (SSR)', () => {
    expect(() => writeSession('jgos-windows', { about: true })).not.toThrow();
  });

  it('serialises to JSON in sessionStorage', () => {
    const ss = makeSS();
    vi.stubGlobal('window', { sessionStorage: ss });
    writeSession('jgos-windows', { about: { open: true } });
    expect(ss._store.get('jgos-windows')).toBe(JSON.stringify({ about: { open: true } }));
  });
});
