import type { Locale } from '@/i18n/routing';

// Date helpers shared by server and client components. This module imports
// nothing but types, so a client component can use it without pulling any
// project or repo data into the browser bundle (spec §4 privacy).

export function isFresh(iso: string, now: Date, maxDays = 14): boolean {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const days = diffMs / (24 * 60 * 60 * 1000);
  return days <= maxDays;
}

export function formatRelative(iso: string, now: Date, locale: Locale): string {
  const diff = new Date(iso).getTime() - now.getTime(); // negative = past
  const abs = Math.abs(diff);

  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  let value: number;
  let unit: Intl.RelativeTimeFormatUnit;

  if (abs < HOUR) {
    value = Math.round(diff / MINUTE);
    unit = 'minute';
  } else if (abs < DAY) {
    value = Math.round(diff / HOUR);
    unit = 'hour';
  } else if (abs < MONTH) {
    value = Math.round(diff / DAY);
    unit = 'day';
  } else if (abs < YEAR) {
    value = Math.round(diff / MONTH);
    unit = 'month';
  } else {
    value = Math.round(diff / YEAR);
    unit = 'year';
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit);
}

/**
 * An absolute date ("18 nov 2026", or "18 de noviembre de 2026" with the long
 * month). A fixed time zone keeps the build output independent of the machine
 * that runs it.
 */
export function formatDate(iso: string, locale: Locale, month: 'short' | 'long'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month,
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso));
}
