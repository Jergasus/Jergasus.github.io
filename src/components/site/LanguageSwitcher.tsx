'use client';

import { usePathname } from 'next/navigation';
import { localizedPath } from '@/i18n/localized-path';
import type { Locale } from '@/i18n/routing';

type LocaleEntry = { code: Locale; label: string };

const LOCALES: LocaleEntry[] = [
  { code: 'es', label: 'ES' },
  { code: 'ca', label: 'CA' },
  { code: 'en', label: 'EN' },
];

type Props = {
  currentLocale: Locale;
  label: string;
};

/** ES / CA / EN as plain links to the same page in each language (a full load). */
export function LanguageSwitcher({ currentLocale, label }: Props) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="os-lang">
      {LOCALES.map(({ code, label: localeLabel }) => (
        <a
          key={code}
          href={localizedPath(pathname, code)}
          hrefLang={code}
          aria-current={code === currentLocale ? 'page' : undefined}
          className="os-lang-link"
        >
          {localeLabel}
        </a>
      ))}
    </nav>
  );
}
