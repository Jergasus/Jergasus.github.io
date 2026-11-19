import type { Metadata } from 'next';
import { SITE_NAME } from '@/content/site';
import { routing, type Locale } from './routing';

// Open Graph names locales as language_TERRITORY. The English copy is
// British ("optimised"), so en_GB.
const OG_LOCALE: Record<Locale, string> = { es: 'es_ES', ca: 'ca_ES', en: 'en_GB' };

/**
 * The Open Graph block every page shares: its own URL (relative; metadataBase
 * makes it absolute), its type (the home pages are the website, case pages
 * are articles), its locale with the other two as alternates, the site name
 * and the locale's share image. Title and description come from the page's
 * own metadata.
 */
export function openGraph(
  locale: Locale,
  url: string,
  type: 'website' | 'article',
): NonNullable<Metadata['openGraph']> {
  return {
    type,
    url,
    siteName: SITE_NAME,
    locale: OG_LOCALE[locale],
    alternateLocale: routing.locales.filter((other) => other !== locale).map((other) => OG_LOCALE[other]),
    images: [`/og/${locale}.png`],
  };
}
