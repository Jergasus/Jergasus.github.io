/**
 * The phone Activity widget's "last commit" line, as ActivityWidget.tsx builds
 * it: the server renders `lastServer` with an absolute date, then the client
 * swaps in `lastLive` with formatRelative(), whose Intl.RelativeTimeFormat
 * output ({ numeric: 'auto' }) is already a whole phrase ("hace 3 días",
 * "ayer", "fa 3 dies", "yesterday"). The template must not add a second
 * relative marker ("último hace ayer", "last 2 days ago").
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formatDate, formatRelative } from '@/lib/dates';
import type { Locale } from '@/i18n/routing';
import es from '../../../messages/es.json';
import ca from '../../../messages/ca.json';
import en from '../../../messages/en.json';

const MESSAGES = { es, ca, en } as const;
const NOW = new Date('2026-11-21T12:00:00Z');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const AGO: Record<string, number> = {
  '10 minutes': 10 * MINUTE,
  '3 hours': 3 * HOUR,
  'one day': DAY,
  'two days': 2 * DAY,
  'five days': 5 * DAY,
  'two months': 61 * DAY,
  'a year': 366 * DAY,
};

const DOUBLED = /hace (hace|ayer|anteayer|el)|fa (fa|ahir|abans|l’)|last .*ago|last (yesterday|last)/i;

/** Mono 13 px in the 390 px widget body (338 px) holds 43 characters. */
const ONE_LINE = 43;

describe('phone activity widget: the last-commit line', () => {
  for (const locale of Object.keys(MESSAGES) as Locale[]) {
    const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'os.phone.activity' });
    const commits = t('commits', { total: 1245 });

    for (const [name, ms] of Object.entries(AGO)) {
      const iso = new Date(NOW.getTime() - ms).toISOString();

      it(`${locale}, ${name} ago: the live line has one relative marker and fits one line`, () => {
        const line = t('lastLive', { time: formatRelative(iso, NOW, locale) });
        expect(line).not.toMatch(DOUBLED);
        expect(`${commits} · ${line}`.length, line).toBeLessThanOrEqual(ONE_LINE);
      });

      it(`${locale}, ${name} ago: the server line reads as a date`, () => {
        const line = t('lastServer', { date: formatDate(iso, locale, 'short') });
        expect(line).not.toMatch(DOUBLED);
        expect(line).not.toMatch(/[{}]/);
        expect(`${commits} · ${line}`.length, line).toBeLessThanOrEqual(ONE_LINE);
      });
    }
  }
});
