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

export function LanguageSwitcher({ currentLocale, label }: Props) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="flex items-center gap-3xs">
      {LOCALES.map(({ code, label: localeLabel }) => (
        <a
          key={code}
          href={localizedPath(pathname, code)}
          hrefLang={code}
          aria-current={code === currentLocale ? 'page' : undefined}
          className="text-step--1 font-mono px-2xs py-3xs border border-transparent aria-[current=page]:border-rule hover:text-accent active:text-accent"
        >
          {localeLabel}
        </a>
      ))}
    </nav>
  );
}
