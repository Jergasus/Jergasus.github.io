'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { themeColor, themeColorDark } from '@/design/theme-color';
import { PREF_KEYS, writePref } from '../storage';

/** The visitor's choice: day, night, or null to follow the system theme. */
export type Theme = 'light' | 'dark' | null;

const SYSTEM_DARK = '(prefers-color-scheme: dark)';

function readTheme(): Theme {
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : null;
}

/** Whether night shows: the visitor's choice, else the system theme. */
function readNight(): boolean {
  const theme = readTheme();
  return theme ? theme === 'dark' : window.matchMedia(SYSTEM_DARK).matches;
}

// The server cannot know the system theme: day, until hydration reads it.
const readServerTheme = (): Theme => null;
const readServerNight = () => false;

/** Both stores change with html[data-theme] and with the system theme. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const system = window.matchMedia(SYSTEM_DARK);
  system.addEventListener('change', onChange);
  return () => {
    observer.disconnect();
    system.removeEventListener('change', onChange);
  };
}

/**
 * Points every meta[name="theme-color"] at the desk colour the visitor sees:
 * a chosen theme paints both, and back on the system theme each meta returns
 * to its own colour scheme's value.
 */
function syncThemeMeta(theme: Theme): void {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const night = theme ? theme === 'dark' : m.media.includes('dark');
    m.content = night ? themeColorDark : themeColor;
  });
}

/**
 * The one way to change the theme (tray, settings, terminal): html[data-theme]
 * for CSS, the remembered choice for the pre-paint script, and the browser
 * chrome's colour.
 */
export function setTheme(theme: Theme): void {
  const html = document.documentElement;
  if (theme) html.setAttribute('data-theme', theme);
  else html.removeAttribute('data-theme');
  writePref(PREF_KEYS.theme, theme);
  syncThemeMeta(theme);
}

export function useTheme(): {
  /** The visitor's choice (null: the system theme). */
  theme: Theme;
  /** Whether night is what shows. */
  night: boolean;
  setTheme(theme: Theme): void;
  /** Switches what shows, day ⇄ night, as an explicit choice. */
  toggle(): void;
} {
  const theme = useSyncExternalStore(subscribe, readTheme, readServerTheme);
  const night = useSyncExternalStore(subscribe, readNight, readServerNight);

  // A theme remembered from an earlier visit (set before paint) reaches the
  // browser chrome too, not only a change in this visit.
  useEffect(() => {
    syncThemeMeta(theme);
  }, [theme]);

  return { theme, night, setTheme, toggle: () => setTheme(readNight() ? 'light' : 'dark') };
}
