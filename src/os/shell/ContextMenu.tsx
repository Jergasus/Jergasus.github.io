'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { WALLPAPERS, type Wallpaper } from '../prepaint';
import { useOsInternal } from '../context';
import { useWallpaper } from './useWallpaper';

type Position = { x: number; y: number };

/** Returns desktop element bounds (taskbar excluded). */
function getDesktopBounds() {
  const el = document.querySelector('[data-desktop]');
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

/** Top-level (main menu) items — marked with data-main-item. */
function getMainItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-main-item]'));
}

/** Submenu items — marked with data-sub-item. */
function getSubItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-sub-item]'));
}

export function ContextMenu() {
  const t = useTranslations('os');
  const os = useOsInternal();
  const { set: setWallpaper } = useWallpaper();

  // rawPos: cursor coordinates when the menu opens (un-clamped).
  // displayPos: position after clamping to desktop bounds (what CSS uses).
  const [rawPos, setRawPos] = useState<Position | null>(null);
  const [displayPos, setDisplayPos] = useState<Position | null>(null);

  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [submenuFlipped, setSubmenuFlipped] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  // Element that had focus when the menu opened — restored on close.
  const openerRef = useRef<HTMLElement | null>(null);
  // True when the submenu was opened via keyboard (triggers auto-focus on first item).
  const submenuKeyboardRef = useRef(false);

  // ── Open on right-click (or keyboard) on [data-desktop] ──────────────────
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-desktop]') || target.closest('[data-icon]')) return;
      e.preventDefault();
      openerRef.current = document.activeElement as HTMLElement;
      setRawPos({ x: e.clientX, y: e.clientY });
      setDisplayPos(null);
      setWallpaperOpen(false);
    };
    // Shift+F10 or Menu key when focus is inside [data-desktop]
    const onKeyMenu = (e: KeyboardEvent) => {
      if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
        const active = document.activeElement;
        if (!active?.closest('[data-desktop]')) return;
        e.preventDefault();
        openerRef.current = active as HTMLElement;
        const rect = active.getBoundingClientRect();
        setRawPos({ x: rect.left, y: rect.bottom });
        setDisplayPos(null);
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

  // ── Clamp position inside desktop bounds after the first render ───────────
  // Runs synchronously before paint so the user never sees the unclamped position.
  useLayoutEffect(() => {
    if (!rawPos || !menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const desktop = document.querySelector('[data-desktop]')?.getBoundingClientRect();
    const maxX = desktop ? desktop.right : window.innerWidth;
    const maxY = desktop ? desktop.bottom : window.innerHeight;
    const x = Math.max(0, Math.min(rawPos.x, maxX - menuRect.width));
    const y = Math.max(0, Math.min(rawPos.y, maxY - menuRect.height));
    setDisplayPos({ x, y });
  }, [rawPos]);

  // ── Detect submenu overflow and flip it left when needed ─────────────────
  useLayoutEffect(() => {
    if (!wallpaperOpen || !menuRef.current) return;
    const submenu = menuRef.current.querySelector<HTMLElement>('[data-submenu]');
    if (!submenu) return;
    const rect = submenu.getBoundingClientRect();
    setSubmenuFlipped(rect.right > window.innerWidth - 4);
  }, [wallpaperOpen]);

  // ── Focus first submenu item when opened via keyboard ────────────────────
  useEffect(() => {
    if (!wallpaperOpen || !submenuKeyboardRef.current) return;
    submenuKeyboardRef.current = false;
    const items = getSubItems(menuRef.current!);
    items[0]?.focus();
  }, [wallpaperOpen]);

  // ── Focus first main item once the display position is established ────────
  useEffect(() => {
    if (!displayPos || !menuRef.current) return;
    const items = getMainItems(menuRef.current);
    items[0]?.focus();
  }, [displayPos]);

  // ── Close (restores focus to opener by default) ───────────────────────────
  const closeMenu = (restoreFocus = true) => {
    setRawPos(null);
    setDisplayPos(null);
    setWallpaperOpen(false);
    if (restoreFocus) {
      openerRef.current?.focus();
      openerRef.current = null;
    }
  };

  // Close on click outside the menu.
  useEffect(() => {
    if (!rawPos) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu(true);
      }
    };
    // Delay one tick so the right-click that opened the menu doesn't also close it.
    const id = window.setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', handler);
    };
  }, [rawPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!menuRef.current) return;
    const focused = document.activeElement as HTMLElement;
    const isInSub = !!focused.closest('[data-submenu]');

    if (isInSub) {
      const items = getSubItems(menuRef.current);
      const idx = items.indexOf(focused);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[idx <= 0 ? items.length - 1 : idx - 1]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
        // Close submenu and return focus to the trigger (first main item).
        e.preventDefault();
        setWallpaperOpen(false);
        getMainItems(menuRef.current)[0]?.focus();
      }
    } else {
      const items = getMainItems(menuRef.current);
      const idx = items.indexOf(focused);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[idx <= 0 ? items.length - 1 : idx - 1]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      } else if ((e.key === 'ArrowRight' || e.key === 'Enter') && idx === 0) {
        // Open or enter the wallpaper submenu.
        e.preventDefault();
        if (wallpaperOpen) {
          // Submenu already open: just move focus into it.
          getSubItems(menuRef.current)[0]?.focus();
        } else {
          submenuKeyboardRef.current = true;
          setWallpaperOpen(true);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(true);
      }
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const pickWallpaper = (w: Wallpaper) => {
    setWallpaper(w);
    closeMenu(true);
  };

  /** Reset icon selection in DesktopIcons (not window arrangement). */
  const arrangeIcons = () => {
    document.dispatchEvent(new CustomEvent('os:arrange-icons'));
    closeMenu(true);
  };

  /** Arrange open windows using the desktop element's bounds (excludes taskbar). */
  const arrange = () => {
    os.dispatch({ type: 'arrange', bounds: getDesktopBounds() });
    closeMenu(true);
  };

  const openSettings = () => {
    os.openApp('settings');
    closeMenu(true);
  };

  if (!rawPos) return null;
  // Render at rawPos first so the layout effect can measure and clamp.
  const pos = displayPos ?? rawPos;

  return (
    <div
      ref={menuRef}
      data-context-menu
      className="os-context-menu"
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 1000 }}
      role="menu"
      aria-label="Escritorio"
      onKeyDown={handleKeyDown}
    >
      {/* Wallpaper submenu trigger */}
      <div className="os-context-item os-context-submenu-trigger">
        <button
          type="button"
          role="menuitem"
          data-main-item
          className="os-context-btn"
          aria-haspopup="true"
          aria-expanded={wallpaperOpen}
          onClick={() => setWallpaperOpen((v) => !v)}
        >
          {t('menu.changeWallpaper')} ▶
        </button>
        {wallpaperOpen && (
          <div
            className="os-context-submenu"
            data-submenu
            data-flipped={submenuFlipped || undefined}
            role="menu"
          >
            {WALLPAPERS.map((w) => (
              <button
                key={w}
                type="button"
                role="menuitem"
                data-sub-item
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
        data-main-item
        className="os-context-btn"
        onClick={arrangeIcons}
      >
        {t('menu.arrangeIcons')}
      </button>

      <button
        type="button"
        role="menuitem"
        data-main-item
        className="os-context-btn"
        onClick={arrange}
      >
        {t('menu.arrange')}
      </button>

      <button
        type="button"
        role="menuitem"
        data-main-item
        className="os-context-btn"
        onClick={openSettings}
      >
        {t('menu.settings')}
      </button>
    </div>
  );
}
