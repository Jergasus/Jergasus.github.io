// Storage helpers. Never throw. All access goes through window.localStorage /
// window.sessionStorage so that SSR and environments without storage are safe.

export type PrefKey = 'jgos-booted' | 'jgos-theme' | 'jgos-wallpaper';

export function readPref(key: PrefKey): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: PrefKey, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // silent — storage may be blocked (private browsing, quota, etc.)
  }
}

export function readSession<T>(key: 'jgos-windows'): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSession(key: 'jgos-windows', value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silent
  }
}
