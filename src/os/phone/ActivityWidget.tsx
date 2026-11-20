'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/routing';
import { formatRelative, formatDate } from '@/lib/dates';

/** Commit count to an intensity level 0–4, relative to the busiest week. */
function intensity(n: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (n === 0 || max === 0) return 0;
  const ratio = n / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

type Props = {
  locale: Locale;
  totalCommits: number;
  lastCommitAt: string;
  weekly: number[];
};

/**
 * Activity widget — appears on the phone home screen.
 * Server renders an absolute date; after mount the date switches to relative.
 */
export function ActivityWidget({ locale, totalCommits, lastCommitAt, weekly }: Props) {
  const t = useTranslations('os.phone');
  // Server: absolute date. Client: switches to relative after mount.
  const serverDate = formatDate(lastCommitAt, locale, 'short');
  const [lastLabel, setLastLabel] = useState<string>(t('activity.lastServer', { date: serverDate }));

  useEffect(() => {
    const rel = formatRelative(lastCommitAt, new Date(), locale);
    setLastLabel(t('activity.lastLive', { time: rel }));
  }, [lastCommitAt, locale, t]);

  const weeklyMax = Math.max(...weekly, 0);

  return (
    <div data-widget="activity" className="os-phone-widget">
      <div className="os-phone-widget-titlebar">
        <span className="os-phone-widget-title">actividad</span>
      </div>
      <div className="os-phone-widget-body os-phone-activity-body">
        <p className="os-phone-activity-stats">
          {t('activity.commits', { total: totalCommits })}
          <span className="os-phone-activity-sep" aria-hidden="true"> · </span>
          {lastLabel}
        </p>
        <div data-phone-grid className="os-phone-mini-grid" aria-hidden="true">
          {weekly.map((n, i) => (
            <span key={i} data-intensity={intensity(n, weeklyMax)} />
          ))}
        </div>
      </div>
    </div>
  );
}
