'use client';

import { useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
// Only the dependency-free date helpers: anything that imports project or
// repo data would ship it to the browser (e2e/privacy.spec.ts).
import { formatDate, formatRelative, isFresh } from '@/lib/dates';
import type { Locale } from '@/i18n/routing';

type Props = {
  lastCommitAt: string;
  totalCommits: number;
  projectCount: number;
  available: boolean;
  availabilityLabel: string;
  /** ISO time of the server render, i.e. build time for the static export. */
  builtAt: string;
};

// The visitor's clock as an external store, at minute resolution so the
// snapshot stays stable between ticks. The server snapshot is null, so the
// server render and the hydration pass agree (both judge freshness against
// the build time); right after hydration React re-renders with the client
// clock: relative time appears, and a stale commit disappears.
const MINUTE = 60 * 1000;
function subscribeToClock(onTick: () => void) {
  const id = window.setInterval(onTick, MINUTE);
  return () => window.clearInterval(id);
}
const readClock = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const readServerClock = () => null;

const item =
  'py-xs lg:py-s lg:px-m lg:first:pl-0 border-t-hair border-rule first:border-t-0 lg:border-t-0 lg:border-l-hair lg:first:border-l-0';

// The strip's top and bottom rules are elements of their own rather than
// borders on the list, so the page-load sequence can draw them in (scaleX
// from the left). Same 2px, same place.
function Rule() {
  return <span aria-hidden="true" data-load-rule className="block origin-left border-t border-rule" />;
}

export function DataStrip({
  lastCommitAt,
  totalCommits,
  projectCount,
  available,
  availabilityLabel,
  builtAt,
}: Props) {
  const t = useTranslations('hero');
  const locale = useLocale() as Locale;

  const clock = useSyncExternalStore<number | null>(subscribeToClock, readClock, readServerClock);
  const now = clock === null ? null : new Date(clock);

  const showLastCommit = isFresh(lastCommitAt, now ?? new Date(builtAt));

  return (
    <div data-testid="data-strip">
      <Rule />
      {/* overflow-clip: a cell settling in (PageLoad) rises into the strip
          with its hairline instead of poking through the bottom rule. */}
      <ul className="grid overflow-clip font-mono text-step--1 lg:auto-cols-fr lg:grid-flow-col lg:text-step-0">
        <li data-load-item className={item}>
          <span
            aria-hidden="true"
            className={`mr-2xs inline-block size-2xs align-middle ${available ? 'bg-accent' : 'border-hair border-ink-muted'}`}
          />
          <span data-testid="availability" className={available ? 'text-ink' : 'text-ink-muted'}>
            {availabilityLabel}
          </span>
        </li>

        {showLastCommit && (
          <li data-testid="last-commit" data-load-item className={item}>
            <span className="text-ink-muted">{t('lastCommit')}</span>{' '}
            {/* The server text (also what no-JS visitors see) is the absolute
                date; the client swaps in relative time. */}
            <time dateTime={lastCommitAt} suppressHydrationWarning>
              {now ? formatRelative(lastCommitAt, now, locale) : formatDate(lastCommitAt, locale, 'short')}
            </time>
          </li>
        )}

        <li data-load-item className={`${item} text-ink-muted`}>
          {t.rich('totalCommits', {
            total: totalCommits,
            projects: projectCount,
            value: (chunks) => <span className="text-ink">{chunks}</span>,
          })}
        </li>
      </ul>
      <Rule />
    </div>
  );
}
