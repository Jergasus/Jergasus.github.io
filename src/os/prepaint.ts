import { PREF_KEYS } from './storage';

export type Wallpaper = 'dots' | 'grid' | 'sunset' | 'cream' | 'barcelona';

/** All valid wallpaper values, used both at runtime and in the pre-paint script. */
export const WALLPAPERS: readonly Wallpaper[] = ['dots', 'grid', 'sunset', 'cream', 'barcelona'];

/** Media query that selects desktop viewports (≥ 64 rem). */
export const DESKTOP_QUERY = '(min-width: 64rem)';

/**
 * Returns a self-contained IIFE string to be inlined in <head> before paint.
 *
 * The string reads from WALLPAPERS and DESKTOP_QUERY so the constants remain
 * a single source of truth.
 *
 * The IIFE:
 *  - sets data-os="desktop|phone" (matchMedia; defaults to desktop if unavailable)
 *  - sets data-wallpaper from storage if valid, else "dots"
 *  - sets data-theme only when storage holds "light" or "dark"
 *  - sets data-boot="1" only on a first visit (jgos-booted !== "1") without
 *    prefers-reduced-motion
 *
 * Every window.localStorage access is in its own try/catch so a blocked
 * storage never prevents data-os or data-wallpaper from being applied.
 * If matchMedia is unavailable, data-os defaults to "desktop".
 */
export function prepaintScript(): string {
  const wallpapersJson = JSON.stringify(WALLPAPERS);
  const desktopQueryJson = JSON.stringify(DESKTOP_QUERY);
  const reducedMotionQueryJson = JSON.stringify('(prefers-reduced-motion: reduce)');
  // Key names come from PREF_KEYS so a rename propagates here automatically.
  const keyWallpaper = JSON.stringify(PREF_KEYS.wallpaper);
  const keyTheme = JSON.stringify(PREF_KEYS.theme);
  const keyBooted = JSON.stringify(PREF_KEYS.booted);

  return `(function(){
var el=document.documentElement;
var isDesktop=true;
try{isDesktop=window.matchMedia(${desktopQueryJson}).matches;}catch(e){}
el.setAttribute('data-os',isDesktop?'desktop':'phone');
var wp='dots';
try{var w=window.localStorage.getItem(${keyWallpaper});if(w&&${wallpapersJson}.indexOf(w)!==-1)wp=w;}catch(e){}
el.setAttribute('data-wallpaper',wp);
try{var t=window.localStorage.getItem(${keyTheme});if(t==='light'||t==='dark')el.setAttribute('data-theme',t);}catch(e){}
try{
var booted=window.localStorage.getItem(${keyBooted});
var rm=false;
try{rm=window.matchMedia(${reducedMotionQueryJson}).matches;}catch(e){}
if(booted!=='1'&&!rm)el.setAttribute('data-boot','1');
}catch(e){}
})();`;
}
