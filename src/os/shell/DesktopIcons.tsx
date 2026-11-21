'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import { DESKTOP_ICON_ORDER, getApp, type AppId } from '../apps';
import { useOsInternal } from '../context';
import { APP_ICONS } from '../icons';

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

  // The icon a pointer was just released on: the click that follows is that
  // pointer's, already handled here.
  const releasedOn = useRef<AppId | null>(null);

  // A pointer: a touch tap opens; a mouse click selects and a double click opens.
  const handlePointerUp = (id: AppId, e: React.PointerEvent) => {
    releasedOn.current = id;
    if (e.pointerType === 'touch') {
      setSelected(id);
      openApp(id);
      return;
    }
    const now = e.timeStamp;
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

  // A click with no pointer behind it opens: Enter or Space on the keyboard
  // and element.click() (detail 0), and a screen reader activating the button
  // (a click without a pointerup first). A pointer's own click was already
  // handled on pointerup, so nothing opens twice.
  const handleClick = (id: AppId, e: React.MouseEvent) => {
    const byPointer = e.detail > 0 && releasedOn.current === id;
    releasedOn.current = null;
    if (!byPointer) openApp(id);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
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

  // One column when the screen is tall enough, two on a laptop (os.css).
  const rows = {
    '--icon-rows': DESKTOP_ICON_ORDER.length,
    '--icon-rows-half': Math.ceil(DESKTOP_ICON_ORDER.length / 2),
  } as React.CSSProperties;

  return (
    <div ref={columnRef} className="os-icon-col" style={rows}>
      {DESKTOP_ICON_ORDER.map((id, index) => {
        const app = getApp(id);
        if (!app) return null;
        const isSelected = selected === id;
        const Icon = APP_ICONS[id];
        return (
          <button
            key={id}
            type="button"
            data-icon={id}
            className={`os-icon${isSelected ? ' os-icon--selected' : ''}`}
            style={{ '--app': `var(--os-c-${app.colour})` } as React.CSSProperties}
            onPointerUp={(e) => handlePointerUp(id, e)}
            onClick={(e) => handleClick(id, e)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span className="os-icon-tile" aria-hidden="true">
              <Icon size={38} />
            </span>
            <span className="os-icon-label">{t(`${app.messageKey}.label`)}</span>
          </button>
        );
      })}
    </div>
  );
}
