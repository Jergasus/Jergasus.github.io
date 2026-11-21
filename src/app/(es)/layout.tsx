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
import { aggregate, parseActivitySnapshot } from '@/lib/activity';
import { SITE_NAME } from '@/content/site';
import { projects } from '@/content/projects';
import { OsRoot } from '@/os/OsRoot';
import snapshot from '../../../data/activity.json';
import { OsWindows } from '@/os/OsWindows';
import { prepaintScript } from '@/os/prepaint';
import '../globals.css';

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
  const [messages, tHero, tContact] = await Promise.all([
    getMessages({ locale: 'es' }),
    getTranslations({ locale: 'es', namespace: 'hero' }),
    getTranslations({ locale: 'es', namespace: 'contact' }),
  ]);
  const avail = availabilityLabel(status, 'es', {
    available: tHero('availability.available'),
    unavailable: tHero('availability.unavailable'),
  });
  const rawActivity = parseActivitySnapshot(snapshot);
  const activity = aggregate(rawActivity);
  const notifRepos = rawActivity.repos.map((r) => ({ slug: r.slug, lastCommitAt: r.lastCommitAt }));
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
          <OsRoot
            locale="es"
            available={status.available}
            availabilityLabel={avail}
            name={SITE_NAME}
            lede={tHero('lede')}
            totalCommits={activity.totalCommits}
            lastCommitAt={activity.lastCommitAt}
            weekly={activity.weekly}
            whatsappMessage={tContact('whatsappMessage')}
            projectCount={projects.length}
            notifRepos={notifRepos}
          >
            {children}
            <OsWindows locale="es" />
          </OsRoot>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
