'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { WALLPAPERS, type Wallpaper } from '../prepaint';
import { PREF_KEYS, writePref } from '../storage';

function readWallpaper(): Wallpaper {
  if (typeof document === 'undefined') return 'dots';
  const w = document.documentElement.getAttribute('data-wallpaper');
  if (w && (WALLPAPERS as readonly string[]).includes(w)) return w as Wallpaper;
  return 'dots';
}

function readServerWallpaper(): Wallpaper {
  return 'dots';
}

function subscribeWallpaper(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-wallpaper'],
  });
  return () => observer.disconnect();
}

export function useWallpaper(): { wallpaper: Wallpaper; set(w: Wallpaper): void } {
  const wallpaper = useSyncExternalStore(subscribeWallpaper, readWallpaper, readServerWallpaper);

  const set = useCallback((w: Wallpaper) => {
    document.documentElement.setAttribute('data-wallpaper', w);
    writePref(PREF_KEYS.wallpaper, w);
  }, []);

  return { wallpaper, set };
}
