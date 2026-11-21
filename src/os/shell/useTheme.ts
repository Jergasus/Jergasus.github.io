'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { themeColor, themeColorDark } from '@/design/theme-color';
import { PREF_KEYS, writePref } from '../storage';

export type Theme = 'light' | 'dark' | null;

function readTheme(): Theme {
  if (typeof document === 'undefined') return null;
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'light' || t === 'dark') return t;
  return null;
}

function readServerTheme(): Theme {
  return null;
}

function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

/**
 * Points every meta[name="theme-color"] at the desk colour the visitor sees:
 * a forced theme paints both, and back on the system theme each meta returns
 * to its own colour scheme's value.
 */
function syncThemeMeta(theme: Theme): void {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const night = theme ? theme === 'dark' : m.media.includes('dark');
    m.content = night ? themeColorDark : themeColor;
  });
}

export function useTheme(): { theme: Theme; toggle(): void } {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme);

  // A theme remembered from an earlier visit (set before paint) reaches the
  // browser chrome too, not only a toggle in this visit.
  useEffect(() => {
    syncThemeMeta(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    if (current === 'dark') {
      // Revert to system (remove forced theme)
      html.removeAttribute('data-theme');
      writePref(PREF_KEYS.theme, null);
      syncThemeMeta(null);
    } else {
      // Force dark
      html.setAttribute('data-theme', 'dark');
      writePref(PREF_KEYS.theme, 'dark');
      syncThemeMeta('dark');
    }
  }, []);

  return { theme, toggle };
}
