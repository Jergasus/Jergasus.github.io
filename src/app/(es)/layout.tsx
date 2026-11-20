import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { osFontVariables } from '@/design/fonts';
import { themeColor, themeColorDark } from '@/design/theme-color';
import { SITE_URL } from '@/content/site';
import { clientMessages } from '@/i18n/client-messages';
import { openGraph } from '@/i18n/open-graph';
import { availabilityLabel, status } from '@/lib/status';
import { OsRoot } from '@/os/OsRoot';
import { OsWindows } from '@/os/OsWindows';
import { prepaintScript } from '@/os/prepaint';
import '../globals.css';

// The browser chrome (Android toolbar, Safari tab bar) takes the desk colour.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeColor },
    { media: '(prefers-color-scheme: dark)', color: themeColorDark },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: 'es', namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: '/',
      // Every page lists itself among its alternates (hreflang self-reference).
      languages: {
        es: '/',
        ca: '/ca/',
        en: '/en/',
        'x-default': '/',
      },
    },
    openGraph: openGraph('es', '/', 'website'),
  };
}

export default async function EsLayout({ children }: { children: ReactNode }) {
  setRequestLocale('es');
  const [messages, tHero] = await Promise.all([
    getMessages({ locale: 'es' }),
    getTranslations({ locale: 'es', namespace: 'hero' }),
  ]);
  const avail = availabilityLabel(status, 'es', {
    available: tHero('availability.available'),
    unavailable: tHero('availability.unavailable'),
  });
  return (
    // The pre-paint script sets data-os, data-wallpaper, data-theme and
    // data-boot on <html> before React sees it.
    <html lang="es" className={osFontVariables} suppressHydrationWarning>
      <head>
        <script id="jgos-prepaint" dangerouslySetInnerHTML={{ __html: prepaintScript() }} />
      </head>
      <body>
        {/* Only what client components translate goes to the browser. */}
        <NextIntlClientProvider messages={clientMessages(messages)}>
          <OsRoot locale="es" available={status.available} availabilityLabel={avail}>
            {children}
            <OsWindows locale="es" />
          </OsRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
