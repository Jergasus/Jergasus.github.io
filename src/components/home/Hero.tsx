import { Fragment } from 'react';
import { getTranslations } from 'next-intl/server';
import { projects } from '@/content/projects';
import { availabilityLabel, status } from '@/lib/status';
import type { Locale } from '@/i18n/routing';
import { DataStrip } from './DataStrip';

type Props = {
  locale: Locale;
  lastCommitAt: string;
  totalCommits: number;
};

export async function Hero({ locale, lastCommitAt, totalCommits }: Props) {
  const t = await getTranslations({ locale, namespace: 'hero' });
  // `hero.heading` holds one display line per "\n". The heading's accessible
  // name is the whole sentence; the line spans are only presentation.
  const lines = t('heading').split('\n');

  return (
    <section className="px-gutter pt-l md:pt-xl">
      <div className="mx-auto grid max-w-page gap-l md:gap-xl">
        {/* Same thirds as the strip below: the poster name spans all three,
            and the lede sits over the strip's last cell. */}
        <div className="grid gap-m lg:grid-cols-3 lg:gap-x-0">
          <h1
            aria-label={lines.join(' ')}
            className="font-display text-step-poster uppercase lg:col-span-3"
          >
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && ' '}
                {/* Masked line for the page-load reveal (PageLoad; the mask
                    and its accent bleed are in globals.css). Below lg each
                    mask is its own row; from lg the masks sit inline,
                    top-aligned, so the name reads as one line with a normal
                    word space. */}
                <span data-hero-mask className="reveal-line-mask block lg:inline-block lg:align-top">
                  <span data-hero-line data-load-line aria-hidden="true" className="reveal-line">
                    {line}
                  </span>
                </span>
              </Fragment>
            ))}
          </h1>
          <p
            data-load-item
            className="max-w-prose text-step-1 text-pretty text-ink lg:col-start-3 lg:pl-m"
          >
            {t('lede')}
          </p>
        </div>

        <DataStrip
          lastCommitAt={lastCommitAt}
          totalCommits={totalCommits}
          projectCount={projects.length}
          available={status.available}
          availabilityLabel={availabilityLabel(status, locale, {
            available: t('availability.available'),
            unavailable: t('availability.unavailable'),
          })}
          builtAt={new Date().toISOString()}
        />
      </div>
    </section>
  );
}
