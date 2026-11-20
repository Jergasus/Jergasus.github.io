'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { apps, type AppId } from '../apps';
import { useOsInternal } from '../context';
import type { Size } from '../window-manager';

type Props = {
  open: boolean;
  onClose(): void;
  startRef: React.RefObject<HTMLButtonElement | null>;
};

export function StartMenu({ open, onClose, startRef }: Props) {
  const t = useTranslations('os');
  const os = useOsInternal();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          startRef.current && !startRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay one tick so the opening click itself does not immediately close the menu
    const id = window.setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', handleClick);
    };
  }, [open, onClose, startRef]);

  // Escape closes and returns focus to start button
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        startRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose, startRef]);

  const openApp = (id: AppId) => {
    const btn = startRef.current ?? undefined;
    os.openApp(id, btn instanceof HTMLButtonElement ? btn : undefined);
    onClose();
  };

  const arrange = () => {
    const bounds: Size = {
      w: window.innerWidth,
      h: window.innerHeight - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--os-taskbar-h') || '40', 10),
    };
    os.dispatch({ type: 'arrange', bounds });
    onClose();
  };

  const startMenuApps = apps.filter((a) => a.inStartMenu);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      data-start-menu
      className="os-start-menu"
      role="menu"
      aria-label={t('taskbar.start')}
    >
      <ul className="os-start-list" role="presentation">
        {startMenuApps.map((app) => (
          <li key={app.id} role="none">
            <button
              type="button"
              role="menuitem"
              className="os-start-item"
              data-open-app={app.id}
              onClick={() => openApp(app.id)}
              style={{ '--app': `var(--os-c-${app.colour})` } as React.CSSProperties}
            >
              {t(`apps.${app.messageKey}.label`)}
            </button>
          </li>
        ))}
      </ul>

      <div className="os-start-divider" role="separator" />

      <ul className="os-start-list" role="presentation">
        <li role="none">
          <button
            type="button"
            role="menuitem"
            className="os-start-item"
            onClick={arrange}
          >
            {t('menu.arrange')}
          </button>
        </li>
      </ul>
    </div>
  );
}
