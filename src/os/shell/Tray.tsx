'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { localizedPath } from '@/i18n/localized-path';
import type { Locale } from '@/i18n/routing';
import { barcelonaTime } from '../clock';
import { useTheme } from './useTheme';

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'ca', label: 'CA' },
  { code: 'en', label: 'EN' },
];

type Props = {
  currentLocale: Locale;
  available: boolean;
  availabilityLabel: string;
};

export function Tray({ currentLocale, available, availabilityLabel }: Props) {
  const t = useTranslations('os');
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [time, setTime] = useState('');

  // Clock: empty string on server, then real time after mount, refreshed every 30 s.
  // This avoids a hydration mismatch.
  useEffect(() => {
    const update = () => setTime(barcelonaTime(new Date(), currentLocale));
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [currentLocale]);

  return (
    <div className="os-tray">
      {/* Availability dot */}
      <span data-tray="availability" className="os-tray-avail" data-available={available}>
        <span className="os-tray-dot" aria-hidden="true" />
        <span className="sr-only">{availabilityLabel}</span>
      </span>

      {/* Language links */}
      <nav data-tray="language" aria-label={t('taskbar.language')} className="os-lang">
        {LOCALES.map(({ code, label }) => (
          <a
            key={code}
            href={localizedPath(pathname, code)}
            hrefLang={code}
            aria-current={code === currentLocale ? 'page' : undefined}
            className="os-lang-link"
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Theme toggle */}
      <span data-tray="theme">
        <button
          type="button"
          className="os-tray-btn"
          aria-pressed={theme === 'dark'}
          onClick={toggle}
          title={t('theme.toggle')}
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </span>

      {/* Clock */}
      <time
        data-tray="clock"
        className="os-tray-clock"
        aria-label={time ? `Hora en Barcelona: ${time}` : undefined}
      >
        {time}
      </time>
    </div>
  );
}
