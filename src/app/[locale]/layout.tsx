import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { osFontVariables } from '@/design/fonts';
import { themeColor, themeColorDark } from '@/design/theme-color';
import { routing, type Locale } from '@/i18n/routing';
import { SITE_URL } from '@/content/site';
import { clientMessages } from '@/i18n/client-messages';
import { openGraph } from '@/i18n/open-graph';
import { availabilityLabel, status } from '@/lib/status';
import { aggregate, parseActivitySnapshot } from '@/lib/activity';
import { SITE_NAME } from '@/content/site';
import { OsRoot } from '@/os/OsRoot';
import snapshot from '../../../data/activity.json';
import { OsWindows } from '@/os/OsWindows';
import { prepaintScript } from '@/os/prepaint';
import '../globals.css';

export const dynamicParams = false;

// The browser chrome (Android toolbar, Safari tab bar) takes the desk colour.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themeColor },
    { media: '(prefers-color-scheme: dark)', color: themeColorDark },
  ],
};

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
  const [messages, tHero, tContact] = await Promise.all([
    getMessages({ locale }),
    getTranslations({ locale, namespace: 'hero' }),
    getTranslations({ locale, namespace: 'contact' }),
  ]);
  const avail = availabilityLabel(status, locale as Locale, {
    available: tHero('availability.available'),
    unavailable: tHero('availability.unavailable'),
  });
  const activity = aggregate(parseActivitySnapshot(snapshot));

  return (
    // The pre-paint script sets data-os, data-wallpaper, data-theme and
    // data-boot on <html> before React sees it.
    <html lang={locale} className={osFontVariables} suppressHydrationWarning>
      <head>
        <script id="jgos-prepaint" dangerouslySetInnerHTML={{ __html: prepaintScript() }} />
      </head>
      <body>
        {/* Only what client components translate goes to the browser. */}
        <NextIntlClientProvider messages={clientMessages(messages)}>
          <OsRoot
            locale={locale as Locale}
            available={status.available}
            availabilityLabel={avail}
            name={SITE_NAME}
            lede={tHero('lede')}
            totalCommits={activity.totalCommits}
            lastCommitAt={activity.lastCommitAt}
            weekly={activity.weekly}
            whatsappMessage={tContact('whatsappMessage')}
          >
            {children}
            <OsWindows locale={locale as Locale} />
          </OsRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
