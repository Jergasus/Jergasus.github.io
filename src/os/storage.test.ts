import { afterEach, describe, expect, it, vi } from 'vitest';
import { PREF_KEYS, SESSION_KEY, SESSION_KEY_TOASTS, readPref, readSession, writePref, writeSession } from './storage';

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
    expect(readPref(PREF_KEYS.booted)).toBe(null);
  });

  it('returns stored value via window.localStorage', () => {
    const ls = makeLS({ [PREF_KEYS.theme]: 'dark' });
    vi.stubGlobal('window', { localStorage: ls });
    expect(readPref(PREF_KEYS.theme)).toBe('dark');
  });

  it('returns null for a key that is not in storage', () => {
    const ls = makeLS();
    vi.stubGlobal('window', { localStorage: ls });
    expect(readPref(PREF_KEYS.booted)).toBe(null);
  });

  it('returns null and writePref is silent when storage throws', () => {
    const throwing = {
      getItem: () => { throw new Error('storage denied'); },
      setItem: () => { throw new Error('storage denied'); },
      removeItem: () => { throw new Error('storage denied'); },
    };
    vi.stubGlobal('window', { localStorage: throwing, sessionStorage: throwing });
    expect(() => readPref(PREF_KEYS.booted)).not.toThrow();
    expect(readPref(PREF_KEYS.booted)).toBe(null);
    expect(() => writePref(PREF_KEYS.booted, '1')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
describe('writePref', () => {
  it('is silent when window is undefined (SSR)', () => {
    expect(() => writePref(PREF_KEYS.theme, 'light')).not.toThrow();
  });

  it('writes a string value to localStorage', () => {
    const ls = makeLS();
    vi.stubGlobal('window', { localStorage: ls });
    writePref(PREF_KEYS.theme, 'light');
    expect(ls._store.get(PREF_KEYS.theme)).toBe('light');
  });

  it('removes the key when value is null', () => {
    const ls = makeLS({ [PREF_KEYS.theme]: 'dark' });
    vi.stubGlobal('window', { localStorage: ls });
    writePref(PREF_KEYS.theme, null);
    expect(ls._store.has(PREF_KEYS.theme)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('readSession', () => {
  it('returns null when window is undefined (SSR)', () => {
    expect(readSession(SESSION_KEY)).toBe(null);
  });

  it('parses JSON from sessionStorage', () => {
    const ss = makeSS({ [SESSION_KEY]: JSON.stringify({ about: { open: true } }) });
    vi.stubGlobal('window', { sessionStorage: ss });
    expect(readSession<{ about: { open: boolean } }>(SESSION_KEY)).toEqual({ about: { open: true } });
  });

  it('returns null when the key is not in sessionStorage', () => {
    const ss = makeSS();
    vi.stubGlobal('window', { sessionStorage: ss });
    expect(readSession(SESSION_KEY)).toBe(null);
  });

  it('returns null when JSON is malformed', () => {
    const ss = makeSS({ [SESSION_KEY]: 'not-json{{{' });
    vi.stubGlobal('window', { sessionStorage: ss });
    expect(readSession(SESSION_KEY)).toBe(null);
  });

  it('stores and reads the toasts session flag with SESSION_KEY_TOASTS', () => {
    const ss = makeSS();
    vi.stubGlobal('window', { sessionStorage: ss });
    writeSession(SESSION_KEY_TOASTS, '1');
    expect(readSession<string>(SESSION_KEY_TOASTS)).toBe('1');
  });
});

// ---------------------------------------------------------------------------
describe('writeSession', () => {
  it('is silent when window is undefined (SSR)', () => {
    expect(() => writeSession(SESSION_KEY, { about: true })).not.toThrow();
  });

  it('serialises to JSON in sessionStorage', () => {
    const ss = makeSS();
    vi.stubGlobal('window', { sessionStorage: ss });
    writeSession(SESSION_KEY, { about: { open: true } });
    expect(ss._store.get(SESSION_KEY)).toBe(JSON.stringify({ about: { open: true } }));
  });
});
