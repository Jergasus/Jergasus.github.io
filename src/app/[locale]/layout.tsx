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
import { projects } from '@/content/projects';
import { OsRoot } from '@/os/OsRoot';
import snapshot from '../../../data/activity.json';
import { OsWindows } from '@/os/OsWindows';
import { WelcomeApp } from '@/os/apps/WelcomeApp';
import { prepaintScript } from '@/os/prepaint';
import '../globals.css';

export const dynamicParams = false;

// The browser chrome (Android toolbar, Safari tab bar) takes the desk colour.
// The OS draws edge to edge like an installed app and pads itself away from
// the notch and the home indicator (env(safe-area-inset-*) in os.css); the
// on-screen keyboard shrinks the layout, so the terminal and wizard inputs
// stay in view.
export const viewport: Viewport = {
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
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
  const rawActivity = parseActivitySnapshot(snapshot);
  const activity = aggregate(rawActivity);
  const notifRepos = rawActivity.repos.map((r) => ({ slug: r.slug, lastCommitAt: r.lastCommitAt }));
  // Rendered once on the server and placed in both the phone home card and the
  // desktop welcome window — no id attributes inside, so duplicates never occur.
  const welcome = <WelcomeApp locale={locale as Locale} />;

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
            welcome={welcome}
            whatsappMessage={tContact('whatsappMessage')}
            totalCommits={activity.totalCommits}
            projectCount={projects.length}
            notifRepos={notifRepos}
          >
            {children}
            <OsWindows locale={locale as Locale} welcome={welcome} />
          </OsRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
