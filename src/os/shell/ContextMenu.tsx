'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WALLPAPERS, type Wallpaper } from '../prepaint';
import { useOsInternal } from '../context';
import type { Size } from '../window-manager';
import { useWallpaper } from './useWallpaper';

type Position = { x: number; y: number };

export function ContextMenu() {
  const t = useTranslations('os');
  const os = useOsInternal();
  const { set: setWallpaper } = useWallpaper();
  const [position, setPosition] = useState<Position | null>(null);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Open on right-click on [data-desktop]
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-desktop]') || target.closest('[data-icon]')) return;
      e.preventDefault();
      setPosition({ x: e.clientX, y: e.clientY });
      setWallpaperOpen(false);
    };
    // Shift+F10 or Menu key when desktop has focus
    const onKeyMenu = (e: KeyboardEvent) => {
      if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
        const active = document.activeElement;
        if (!active?.closest('[data-desktop]')) return;
        e.preventDefault();
        const rect = active.getBoundingClientRect();
        setPosition({ x: rect.left, y: rect.bottom });
        setWallpaperOpen(false);
      }
    };
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyMenu);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyMenu);
    };
  }, []);

  // Close on outside click or Escape
  useEffect(() => {
    if (!position) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPosition(null);
      }
    };
    const closeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPosition(null);
    };
    // Delay one tick so the right-click that opens it doesn't also close it
    const id = window.setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('keydown', closeKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', closeKey);
    };
  }, [position]);

  const pickWallpaper = (w: Wallpaper) => {
    setWallpaper(w);
    setPosition(null);
  };

  const arrange = () => {
    const bounds: Size = {
      w: window.innerWidth,
      h: window.innerHeight -
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue('--os-taskbar-h') || '40',
          10,
        ),
    };
    os.dispatch({ type: 'arrange', bounds });
    setPosition(null);
  };

  if (!position) return null;

  // Keep the menu within the viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      data-context-menu
      className="os-context-menu"
      style={menuStyle}
      role="menu"
      aria-label="Escritorio"
    >
      {/* Wallpaper submenu */}
      <div className="os-context-item os-context-submenu-trigger">
        <button
          type="button"
          role="menuitem"
          className="os-context-btn"
          aria-haspopup="true"
          aria-expanded={wallpaperOpen}
          onClick={() => setWallpaperOpen((v) => !v)}
        >
          {t('menu.changeWallpaper')} ▶
        </button>
        {wallpaperOpen && (
          <div className="os-context-submenu" role="menu">
            {WALLPAPERS.map((w) => (
              <button
                key={w}
                type="button"
                role="menuitem"
                className="os-context-btn"
                onClick={() => pickWallpaper(w)}
              >
                {t(`wallpapers.${w}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div role="separator" className="os-context-sep" />

      <button
        type="button"
        role="menuitem"
        className="os-context-btn"
        onClick={() => {
          os.dispatch({ type: 'arrange', bounds: { w: window.innerWidth, h: window.innerHeight } });
          setPosition(null);
        }}
      >
        {t('menu.arrangeIcons')}
      </button>

      <button
        type="button"
        role="menuitem"
        className="os-context-btn"
        onClick={arrange}
      >
        {t('menu.arrange')}
      </button>

      <button
        type="button"
        role="menuitem"
        className="os-context-btn"
        onClick={() => {
          os.openApp('settings');
          setPosition(null);
        }}
      >
        {t('menu.settings')}
      </button>
    </div>
  );
}
