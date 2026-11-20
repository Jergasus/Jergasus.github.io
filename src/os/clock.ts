import type { Locale } from '@/i18n/routing';

/**
 * Current time in Barcelona (Europe/Madrid), 24-hour HH:MM format.
 * Uses Intl so it respects DST automatically (CET/CEST).
 */
export function barcelonaTime(now: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}
