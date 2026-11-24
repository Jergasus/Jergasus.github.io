// Storage helpers. Never throw. All access goes through window.localStorage /
// window.sessionStorage so that SSR and environments without storage are safe.

/** Runtime key names — single source of truth for all modules (including prepaint). */
export const PREF_KEYS = {
  theme: 'jgos-theme',
  wallpaper: 'jgos-wallpaper',
} as const;

/** Derived union type — always in sync with PREF_KEYS. */
export type PrefKey = (typeof PREF_KEYS)[keyof typeof PREF_KEYS];

/** sessionStorage key for window state — exported so prepaint and other modules share it. */
export const SESSION_KEY = 'jgos-windows' as const;
export type SessionKey = typeof SESSION_KEY;

/** sessionStorage key for the once-per-session toasts flag. */
export const SESSION_KEY_TOASTS = 'jgos-toasts' as const;
export type ToastsSessionKey = typeof SESSION_KEY_TOASTS;

/** Union of all session storage keys — single source of truth. */
export type AnySessionKey = typeof SESSION_KEY | typeof SESSION_KEY_TOASTS;

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

export function readSession<T>(key: AnySessionKey): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSession(key: AnySessionKey, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silent
  }
}
