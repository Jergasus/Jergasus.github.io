'use client';

/** Returns the desktop element's client rect size (taskbar excluded). */
export function desktopBounds(): { w: number; h: number } {
  const el = document.querySelector<HTMLElement>('[data-desktop]');
  if (el) {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  const taskbarH = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--os-taskbar-h') || '40',
    10,
  );
  return { w: window.innerWidth, h: window.innerHeight - taskbarH };
}

/**
 * Where windows start so they clear the desktop icons: the right edge of the
 * last icon column (one or two, os.css), plus the column's 8 px padding and
 * an 8 px gap. That is 128 for one column (R8) and 240 for two, the same as
 * --os-win-min-x for windows that have not moved yet.
 */
export function iconsEdge(): number {
  let right = 0;
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((icon) => {
    right = Math.max(right, icon.getBoundingClientRect().right);
  });
  return right > 0 ? Math.round(right) + 8 + 8 : 128;
}
