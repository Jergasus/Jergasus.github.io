'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apps, type AppId } from '../apps';
import { useOsInternal } from '../context';
import { APP_ICONS } from '../icons';
import { desktopBounds, iconsEdge } from './desktopBounds';
import { localizedPath } from '@/i18n/localized-path';
import type { Locale } from '@/i18n/routing';

type Props = {
  open: boolean;
  onClose(): void;
  startRef: React.RefObject<HTMLButtonElement | null>;
};

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'ca', label: 'CA' },
  { code: 'en', label: 'EN' },
];


/** All menuitems within the menu element (buttons and links with the role). */
function getItems(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

export function StartMenu({ open, onClose, startRef }: Props) {
  const t = useTranslations('os');
  const os = useOsInternal();
  const { locale } = os;
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus first item whenever the menu opens.
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const items = getItems(menuRef.current);
    items[0]?.focus();
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        startRef.current && !startRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay one tick so the opening click itself does not immediately close the menu.
    const id = window.setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', handleClick);
    };
  }, [open, onClose, startRef]);

  // Keyboard: Escape closes + returns focus; Arrow keys move between items; Home/End jump.
  useEffect(() => {
    if (!open || !menuRef.current) return;
    const menu = menuRef.current;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        startRef.current?.focus();
        return;
      }
      const items = getItems(menu);
      if (!items.length) return;
      const focused = document.activeElement as HTMLElement;
      const idx = items.indexOf(focused);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = idx < 0 ? 0 : (idx + 1) % items.length;
        items[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = idx <= 0 ? items.length - 1 : idx - 1;
        items[prev]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
    };
    menu.addEventListener('keydown', handleKey);
    return () => menu.removeEventListener('keydown', handleKey);
  }, [open, onClose, startRef]);

  const openApp = (id: AppId) => {
    const btn = startRef.current ?? undefined;
    os.openApp(id, btn instanceof HTMLButtonElement ? btn : undefined);
    onClose();
  };

  const arrange = () => {
    os.dispatch({ type: 'arrange', bounds: desktopBounds(), left: iconsEdge() });
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
      {/* App list — includes settings ("Personalizar") since it has inStartMenu:true */}
      <ul className="os-start-list" role="presentation">
        {startMenuApps.map((app) => {
          const Icon = APP_ICONS[app.id];
          return (
            <li key={app.id} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="os-start-item"
                data-open-app={app.id}
                onClick={() => openApp(app.id)}
                style={{ '--app': `var(--os-c-${app.colour})` } as React.CSSProperties}
              >
                <span className="os-start-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                {t(`apps.${app.messageKey}.label`)}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="os-start-divider" role="separator" />

      {/* System actions */}
      <ul className="os-start-list" role="presentation">
        <li role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="os-start-item"
            onClick={arrange}
          >
            {t('menu.arrange')}
          </button>
        </li>
      </ul>

      <div className="os-start-divider" role="separator" />

      {/* Language links — path-aware, hrefLang */}
      <ul className="os-start-list" role="presentation">
        {LOCALES.map(({ code, label }) => (
          <li key={code} role="none">
            <a
              role="menuitem"
              tabIndex={-1}
              className="os-start-item"
              href={localizedPath(pathname, code)}
              hrefLang={code}
              aria-current={code === locale ? 'page' : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
