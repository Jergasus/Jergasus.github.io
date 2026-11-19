import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { displayFont, textFont, monoFont } from '@/design/fonts';
import { themeColor } from '@/design/theme-color';
import { routing, type Locale } from '@/i18n/routing';
import { SITE_URL } from '@/content/site';
import { clientMessages } from '@/i18n/client-messages';
import { openGraph } from '@/i18n/open-graph';
import { SiteShell } from '@/components/site/SiteShell';
import '../globals.css';

export const dynamicParams = false;

// The browser chrome (Android toolbar, Safari tab bar) matches the paper.
export const viewport: Viewport = { themeColor };

export function generateStaticParams() {
  return [{ locale: 'ca' }, { locale: 'en' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `/${locale}/`,
      languages: {
        es: '/',
        ca: '/ca/',
        en: '/en/',
        'x-default': '/',
      },
    },
    openGraph: openGraph(locale, `/${locale}/`, 'website'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      className={`${displayFont.variable} ${textFont.variable} ${monoFont.variable}`}
    >
      <body>
        {/* Only what client components translate goes to the browser. */}
        <NextIntlClientProvider messages={clientMessages(messages)}>
          <SiteShell locale={locale as Locale}>{children}</SiteShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
