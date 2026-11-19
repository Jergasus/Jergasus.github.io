import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { contact } from '@/content/contact';

type Props = { locale: Locale };

export async function Footer({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'footer' });
  const year = new Date().getFullYear();

  return (
    // No top margin: every page ends in a block with its own bottom space
    // (a section's padding, the case nav's), so a margin here would double it.
    <footer className="border-t border-rule px-gutter py-m">
      <div className="mx-auto flex max-w-page flex-col gap-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-step--1 text-ink-muted">
          {t('copy')} · @Jergasus · {year}
        </p>
        <div className="flex gap-m">
          <a
            href={contact.github}
            rel="noopener noreferrer"
            target="_blank"
            aria-label={t('githubAriaLabel')}
            className="font-mono text-step--1 text-ink-muted hover:text-ink active:text-ink"
          >
            GitHub
          </a>
          <a
            href={contact.linkedin}
            rel="noopener noreferrer"
            target="_blank"
            aria-label={t('linkedinAriaLabel')}
            className="font-mono text-step--1 text-ink-muted hover:text-ink active:text-ink"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
