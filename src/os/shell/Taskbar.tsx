'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { getApp, type AppId } from '../apps';
import { useOsInternal } from '../context';
import { APP_ICONS, JgOsLogo } from '../icons';
import type { Locale } from '@/i18n/routing';
import { Tray } from './Tray';
import { StartMenu } from './StartMenu';

type Props = {
  locale: Locale;
  available: boolean;
  availabilityLabel: string;
};

export function Taskbar({ locale, available, availabilityLabel }: Props) {
  const t = useTranslations('os');
  const os = useOsInternal();
  const { state } = os;
  const startRef = useRef<HTMLButtonElement>(null);
  const [startOpen, setStartOpen] = useState(false);

  // Every open window, minimised ones included, in a stable (z-independent)
  // order: alphabetical by id, so task buttons never jump when z-order changes.
  const taskIds: AppId[] = (Object.entries(state.windows) as [AppId, { open: boolean }][])
    .filter(([, w]) => w.open)
    .map(([id]) => id)
    .sort();

  const handleTaskClick = (id: AppId) => {
    const win = state.windows[id];
    if (!win.open) return;
    if (win.minimized) {
      // Restore: open it and focus
      os.openApp(id);
    } else if (state.focused === id) {
      // Currently focused: minimise
      os.minimizeApp(id);
    } else {
      // Bring to front
      os.focusApp(id);
    }
  };

  const toggleStart = () => {
    setStartOpen((prev) => !prev);
  };

  return (
    <div data-taskbar className="os-taskbar">
      {/* Start button: the OS's own name and logo (spec §9.1), named as the
          menu it opens ("Menú JG-OS", which contains the visible name). */}
      <button
        ref={startRef}
        type="button"
        data-start
        className="os-start-btn"
        aria-label={t('taskbar.start')}
        aria-haspopup="menu"
        aria-expanded={startOpen}
        onClick={toggleStart}
      >
        <JgOsLogo size={22} />
        {t('name')}
      </button>

      {/* Start menu (above the taskbar) */}
      <StartMenu
        open={startOpen}
        onClose={() => setStartOpen(false)}
        startRef={startRef}
      />

      {/* Task buttons — one per open window */}
      <div className="os-tasks">
        {taskIds.map((id) => {
          const app = getApp(id);
          if (!app) return null;
          const win = state.windows[id];
          const isFocused = state.focused === id && !win.minimized;
          const Icon = APP_ICONS[id];
          return (
            <button
              key={id}
              type="button"
              data-task={id}
              className="os-task-btn"
              aria-pressed={isFocused}
              onClick={() => handleTaskClick(id)}
              style={{ '--app': `var(--os-c-${app.colour})` } as React.CSSProperties}
            >
              <Icon size={18} />
              <span className="os-task-label">{t(`apps.${app.messageKey}.label`)}</span>
            </button>
          );
        })}
      </div>

      {/* Tray */}
      <Tray
        currentLocale={locale}
        available={available}
        availabilityLabel={availabilityLabel}
      />
    </div>
  );
}
