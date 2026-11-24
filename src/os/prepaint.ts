import { BOOT_MS } from './shell/boot-timing';
import { PREF_KEYS } from './storage';

export type Wallpaper = 'dots' | 'grid' | 'sunset' | 'cream' | 'barcelona';

/** All valid wallpaper values, used both at runtime and in the pre-paint script. */
export const WALLPAPERS: readonly Wallpaper[] = ['dots', 'grid', 'sunset', 'cream', 'barcelona'];

/** Media query that selects desktop viewports (≥ 64 rem). */
export const DESKTOP_QUERY = '(min-width: 64rem)';

/**
 * Global flag checked by the pre-paint script in e2e builds.
 * Set by page.addInitScript before navigation to skip the boot screen.
 * Never present in deploy builds (the flag check is not emitted).
 */
export const SKIP_BOOT_FLAG = '__jgosSkipBoot';

/**
 * Returns a self-contained IIFE string to be inlined in <head> before paint.
 *
 * The string reads from WALLPAPERS, DESKTOP_QUERY and BOOT_MS so the constants
 * remain a single source of truth.
 *
 * The IIFE:
 *  - sets data-os="desktop|phone" (matchMedia; defaults to desktop if unavailable)
 *  - sets data-wallpaper from storage if valid, else "dots"
 *  - sets data-theme only when storage holds "light" or "dark"
 *  - on every full load, unless prefers-reduced-motion (or the e2e skip flag in
 *    e2e builds): sets data-boot="1", registers keydown and click capture
 *    listeners on document, and schedules window.setTimeout(end, BOOT_MS).
 *    The end() function removes data-boot, both listeners and the timer; on a
 *    click it also calls preventDefault() and stopPropagation() so nothing
 *    underneath acts on the tap.
 *
 * Every window.localStorage access is in its own try/catch so a blocked
 * storage never prevents data-os or data-wallpaper from being applied.
 * The boot runs even when storage is unavailable.
 * If matchMedia is unavailable, data-os defaults to "desktop".
 *
 * @param options.e2e When true (default: NEXT_PUBLIC_E2E === '1'), emits a
 *   check for window[SKIP_BOOT_FLAG] before booting. Deploy builds pass
 *   { e2e: false } and the flag check is not in the generated string.
 */
export function prepaintScript(options?: { e2e?: boolean }): string {
  const isE2E = options?.e2e ?? (process.env.NEXT_PUBLIC_E2E === '1');
  const wallpapersJson = JSON.stringify(WALLPAPERS);
  const desktopQueryJson = JSON.stringify(DESKTOP_QUERY);
  const reducedMotionQueryJson = JSON.stringify('(prefers-reduced-motion: reduce)');
  // Key names come from PREF_KEYS so a rename propagates here automatically.
  const keyWallpaper = JSON.stringify(PREF_KEYS.wallpaper);
  const keyTheme = JSON.stringify(PREF_KEYS.theme);
  // The skip-flag check is emitted only in e2e builds; deploy builds don't mention the flag.
  const skipCheck = isE2E ? `&&!(window[${JSON.stringify(SKIP_BOOT_FLAG)}]===true)` : '';

  return `(function(){
var el=document.documentElement;
var isDesktop=true;
try{isDesktop=window.matchMedia(${desktopQueryJson}).matches;}catch(e){}
el.setAttribute('data-os',isDesktop?'desktop':'phone');
var wp='dots';
try{var w=window.localStorage.getItem(${keyWallpaper});if(w&&${wallpapersJson}.indexOf(w)!==-1)wp=w;}catch(e){}
el.setAttribute('data-wallpaper',wp);
try{var t=window.localStorage.getItem(${keyTheme});if(t==='light'||t==='dark')el.setAttribute('data-theme',t);}catch(e){}
var rm=false;
try{rm=window.matchMedia(${reducedMotionQueryJson}).matches;}catch(e){}
var tid;
if(!rm${skipCheck}){
el.setAttribute('data-boot','1');
document.addEventListener('keydown',end,true);
document.addEventListener('click',end,true);
tid=window.setTimeout(end,${BOOT_MS});
}
function end(ev){
el.removeAttribute('data-boot');
document.removeEventListener('keydown',end,true);
document.removeEventListener('click',end,true);
window.clearTimeout(tid);
if(ev&&ev.type==='click'&&ev.target&&ev.target.closest&&ev.target.closest('[data-boot-screen]')){ev.preventDefault();ev.stopPropagation();}
}
})();`;
}
