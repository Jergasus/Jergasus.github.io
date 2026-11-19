import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { displayFont, textFont, monoFont } from '@/design/fonts';
import { themeColor } from '@/design/theme-color';
import { SITE_URL } from '@/content/site';
import { clientMessages } from '@/i18n/client-messages';
import { openGraph } from '@/i18n/open-graph';
import { SiteShell } from '@/components/site/SiteShell';
import '../globals.css';

// The browser chrome (Android toolbar, Safari tab bar) matches the paper.
export const viewport: Viewport = { themeColor };

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
  const messages = await getMessages({ locale: 'es' });
  return (
    <html
      lang="es"
      className={`${displayFont.variable} ${textFont.variable} ${monoFont.variable}`}
    >
      <body>
        {/* Only what client components translate goes to the browser. */}
        <NextIntlClientProvider messages={clientMessages(messages)}>
          <SiteShell locale="es">{children}</SiteShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
