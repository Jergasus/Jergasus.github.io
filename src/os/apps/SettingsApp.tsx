'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { localizedPath } from '@/i18n/localized-path';
import type { Locale } from '@/i18n/routing';
import { themeColor, themeColorDark } from '@/design/theme-color';
import { WALLPAPERS, type Wallpaper } from '../prepaint';
import { PREF_KEYS, writePref } from '../storage';
import { useTheme } from '../shell/useTheme';
import { useWallpaper } from '../shell/useWallpaper';

const LOCALE_ENTRIES: { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'ca', label: 'CA' },
  { code: 'en', label: 'EN' },
];

type ThemeOption = 'system' | 'light' | 'dark';

type Props = { locale: Locale };

export function SettingsApp({ locale }: Props) {
  const t = useTranslations('os');
  const pathname = usePathname();
  const { wallpaper, set: setWallpaper } = useWallpaper();
  const { theme } = useTheme();

  const handleWallpaper = (w: Wallpaper) => setWallpaper(w);

  // null = system, 'light' = day, 'dark' = night
  const handleTheme = (value: ThemeOption) => {
    const html = document.documentElement;
    if (value === 'dark') {
      html.setAttribute('data-theme', 'dark');
      writePref(PREF_KEYS.theme, 'dark');
      // Sync theme-color meta to dark colour
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = themeColorDark;
      });
    } else if (value === 'light') {
      html.setAttribute('data-theme', 'light');
      writePref(PREF_KEYS.theme, 'light');
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = themeColor;
      });
    } else {
      html.removeAttribute('data-theme');
      writePref(PREF_KEYS.theme, null);
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = themeColor;
      });
    }
  };

  const currentThemeValue: ThemeOption = theme ?? 'system';

  return (
    <div className="os-settings">
      {/* Wallpaper */}
      <section className="os-settings-section">
        <h3 className="os-settings-heading">{t('wallpapers.heading')}</h3>
        <div className="os-settings-radios" role="radiogroup" aria-label={t('wallpapers.heading')}>
          {WALLPAPERS.map((w) => (
            <label key={w} className="os-settings-radio-label">
              <input
                type="radio"
                name="wallpaper"
                value={w}
                checked={wallpaper === w}
                onChange={() => handleWallpaper(w)}
              />
              <span>{t(`wallpapers.${w}`)}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section className="os-settings-section">
        <h3 className="os-settings-heading">{t('theme.heading')}</h3>
        <div className="os-settings-radios" role="radiogroup" aria-label={t('theme.heading')}>
          {((['system', 'light', 'dark'] as ThemeOption[])).map((value) => {
            const labelKey =
              value === 'system' ? 'theme.system' : value === 'light' ? 'theme.light' : 'theme.dark';
            return (
              <label key={value} className="os-settings-radio-label">
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={currentThemeValue === value}
                  onChange={() => handleTheme(value)}
                />
                <span>{t(labelKey)}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* Language */}
      <section className="os-settings-section">
        <h3 className="os-settings-heading">{t('settings.language')}</h3>
        <nav className="os-lang" aria-label={t('settings.language')}>
          {LOCALE_ENTRIES.map(({ code, label }) => (
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
      </section>
    </div>
  );
}
