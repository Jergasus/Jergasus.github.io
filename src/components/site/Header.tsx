import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { Locale } from '@/i18n/routing';

function localeRoot(locale: Locale): string {
  return locale === 'es' ? '/' : `/${locale}/`;
}

type Props = { locale: Locale };

export async function Header({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  const ts = await getTranslations({ locale, namespace: 'switcher' });
  const root = localeRoot(locale);

  return (
    // data-site-header: the contract the work preview uses to stay below it.
    // The view-transition name captures the header on its own during a page
    // transition, so it stays still while the content moves (globals.css).
    // Its nav links are root + hash (/#work, /en/#work): from a case page
    // they lead back to the home section.
    <header
      data-site-header
      style={{ viewTransitionName: 'site-header' }}
      className="sticky top-0 z-10 bg-paper border-b border-rule px-gutter"
    >
      <div className="flex items-center justify-between gap-m py-s max-w-[var(--container-page)] mx-auto">
        {/* Header links cut to the accent on hover and on press, as the work
            rows do: a hard colour cut (`hover:` is fine-pointer only, so
            touch gets `active:`). Keyboard focus shows the focus ring. */}
        <a
          href={root}
          className="font-display text-step-1 text-ink no-underline hover:text-accent active:text-accent"
        >
          Jesús García
        </a>

        <nav aria-label={t('siteLabel')} className="hidden md:flex items-center gap-m">
          {(
            [
              ['work', 'work'],
              ['now', 'now'],
              ['business', 'business'],
              ['about', 'about'],
              ['contact', 'contact'],
            ] as const
          ).map(([key, id]) => (
            <a
              key={key}
              href={`${root}#${id}`}
              className="text-step--1 text-ink no-underline hover:text-accent active:text-accent"
            >
              {t(key)}
            </a>
          ))}
        </nav>

        <LanguageSwitcher currentLocale={locale} label={ts('label')} />
      </div>
    </header>
  );
}
