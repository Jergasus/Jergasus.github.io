'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { localizedPath } from '@/i18n/localized-path';
import type { Locale } from '@/i18n/routing';
import { PHONE_ICON_ORDER, getApp } from '../apps';
import { APP_ICONS, ChatIcon, MailIcon } from '../icons';
import { barcelonaTime } from '../clock';
import { mailtoHref, whatsappHref } from '@/content/contact';
import { useOsInternal } from '../context';
import { HelloWidget } from './HelloWidget';
import { ActivityWidget } from './ActivityWidget';

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'ca', label: 'CA' },
  { code: 'en', label: 'EN' },
];

type Props = {
  locale: Locale;
  available: boolean;
  availabilityLabel: string;
  name: string;
  lede: string;
  totalCommits: number;
  lastCommitAt: string;
  weekly: number[];
  whatsappMessage: string;
};

/**
 * Phone home screen — the full-screen canvas shown on [data-os="phone"] when
 * no app is active. All app-specific data is passed as props from the server.
 */
export function PhoneHome({
  locale,
  available,
  availabilityLabel,
  name,
  lede,
  totalCommits,
  lastCommitAt,
  weekly,
  whatsappMessage,
}: Props) {
  const t = useTranslations('os');
  const tPhone = useTranslations('os.phone');
  const { openApp } = useOsInternal();
  const pathname = usePathname();

  // Status bar clock — empty on server to avoid hydration mismatch.
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(barcelonaTime(new Date(), locale));
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, [locale]);

  return (
    // role="region" + aria-label makes this a named landmark so axe is satisfied.
    <div data-phone-home role="region" aria-label={tPhone('homeLabel')} className="os-phone-home">
      {/* Status bar: language links left, clock right */}
      <div className="os-phone-statusbar">
        <nav aria-label={t('taskbar.language')} className="os-lang">
          {LOCALES.map(({ code, label }) => (
            <a
              key={code}
              href={localizedPath(pathname, code)}
              hrefLang={code}
              aria-current={code === locale ? 'page' : undefined}
              className="os-lang-link"
            >
              {label}
            </a>
          ))}
        </nav>
        <time className="os-tray-clock">{time}</time>
      </div>

      {/* Widgets */}
      <div className="os-phone-widgets">
        <HelloWidget
          name={name}
          lede={lede}
          available={available}
          availabilityLabel={availabilityLabel}
        />
        <ActivityWidget
          locale={locale}
          totalCommits={totalCommits}
          lastCommitAt={lastCommitAt}
          weekly={weekly}
        />
      </div>

      {/* Icon grid */}
      <ul className="os-phone-icon-grid">
        {PHONE_ICON_ORDER.map((id) => {
          const app = getApp(id);
          if (!app) return null;
          const label = t(`apps.${app.messageKey}.label`);
          const Icon = APP_ICONS[id];
          return (
            <li key={id} className="os-phone-icon-li">
            <button
              type="button"
              data-phone-icon={id}
              aria-label={label}
              className="os-phone-icon"
              style={{ '--app': `var(--os-c-${app.colour})` } as React.CSSProperties}
              // The icon is the opener: the app grows out of it, closes back
              // into it, and focus returns to it. (Case apps navigate; openApp
              // handles that path.)
              onClick={(event) => openApp(id, event.currentTarget)}
            >
              <span className="os-phone-icon-tile" aria-hidden="true">
                <Icon size={38} />
              </span>
              <span className="os-phone-icon-label">{label}</span>
            </button>
            </li>
          );
        })}
      </ul>

      {/* Dock: Correo + WhatsApp — always visible */}
      <div data-dock className="os-phone-dock">
        <a
          href={mailtoHref()}
          className="os-phone-dock-btn"
          aria-label={tPhone('dock.mailLabel')}
        >
          <span className="os-phone-dock-icon" style={{ '--app': 'var(--os-c-cream)' } as React.CSSProperties} aria-hidden="true">
            <MailIcon size={30} />
          </span>
          <span className="os-phone-dock-label">{tPhone('dock.mailLabel')}</span>
        </a>
        <a
          href={whatsappHref(whatsappMessage)}
          className="os-phone-dock-btn"
          aria-label={tPhone('dock.whatsappLabel')}
          rel="noopener noreferrer"
        >
          <span className="os-phone-dock-icon" style={{ '--app': 'var(--os-c-mint)' } as React.CSSProperties} aria-hidden="true">
            <ChatIcon size={30} />
          </span>
          <span className="os-phone-dock-label">{tPhone('dock.whatsappLabel')}</span>
        </a>
      </div>
    </div>
  );
}
