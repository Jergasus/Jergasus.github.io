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
 * icon column (one column: 128 px, two columns: 240 px), plus the column's
 * 8 px padding and an 8 px gap. The fallback stays 128 for pages with no
 * visible icons.
 */
export function iconsEdge(): number {
  let right = 0;
  document.querySelectorAll<HTMLElement>('[data-icon]').forEach((icon) => {
    right = Math.max(right, icon.getBoundingClientRect().right);
  });
  return right > 0 ? Math.round(right) + 8 + 8 : 128;
}
