'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { DESKTOP_ICON_ORDER, getApp, type AppId } from '../apps';
import { useOsInternal } from '../context';

export function DesktopIcons() {
  const t = useTranslations('os.apps');
  const os = useOsInternal();
  const [selected, setSelected] = useState<AppId | null>(null);

  // "Arrange icons" clears the icon selection; dispatched by ContextMenu.
  useEffect(() => {
    const handler = () => setSelected(null);
    document.addEventListener('os:arrange-icons', handler);
    return () => document.removeEventListener('os:arrange-icons', handler);
  }, []);
  const lastClickRef = useRef<{ id: AppId; time: number } | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  const openApp = (id: AppId) => {
    const btn = columnRef.current?.querySelector<HTMLElement>(`[data-icon="${id}"]`);
    os.openApp(id, btn ?? undefined);
  };

  const handleClick = (id: AppId, e: React.PointerEvent) => {
    // Touch: single tap opens
    if (e.pointerType === 'touch') {
      setSelected(id);
      openApp(id);
      return;
    }
    // Mouse: single click selects, double click opens
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.id === id && now - last.time < 500) {
      // Double click
      lastClickRef.current = null;
      openApp(id);
    } else {
      lastClickRef.current = { id, time: now };
      setSelected(id);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: AppId, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openApp(id);
      return;
    }
    // Arrow key navigation within the column
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? index + 1 : index - 1;
      const nextId = DESKTOP_ICON_ORDER[next];
      if (nextId) {
        const btn = columnRef.current?.querySelector<HTMLElement>(`[data-icon="${nextId}"]`);
        btn?.focus();
        setSelected(nextId);
      }
    }
  };

  return (
    <div ref={columnRef} className="os-icon-col">
      {DESKTOP_ICON_ORDER.map((id, index) => {
        const app = getApp(id);
        if (!app) return null;
        const isSelected = selected === id;
        return (
          <button
            key={id}
            type="button"
            data-icon={id}
            className={`os-icon${isSelected ? ' os-icon--selected' : ''}`}
            style={{ '--app': `var(--os-c-${app.colour})` } as React.CSSProperties}
            onPointerUp={(e) => handleClick(id, e)}
            onKeyDown={(e) => handleKeyDown(e, id, index)}
          >
            <span className="os-icon-tile" aria-hidden="true">
              <span className="os-icon-glyph">{getIconGlyph(id)}</span>
            </span>
            <span className="os-icon-label">{t(`${app.messageKey}.label`)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Simple text glyphs for icons until real artwork is added in a later task. */
function getIconGlyph(id: AppId): string {
  const glyphs: Partial<Record<AppId, string>> = {
    about: '👤',
    projects: '📁',
    questday: '🧩',
    sakurai: '🌸',
    'rally-voley': '🏐',
    yokaido: '🏮',
    activity: '📊',
    business: '📋',
    contact: '✉',
    terminal: '⌨',
    browser: '🌐',
  };
  return glyphs[id] ?? '📄';
}
