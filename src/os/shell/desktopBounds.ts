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
