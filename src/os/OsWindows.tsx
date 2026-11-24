import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { getApp, type AppId } from './apps';
import { AboutApp } from './apps/AboutApp';
import { ActivityApp } from './apps/ActivityApp';
import { BrowserApp } from './apps/BrowserApp';
import { BusinessApp } from './apps/BusinessApp';
import { ContactApp } from './apps/ContactApp';
import { ProjectsApp } from './apps/ProjectsApp';
import { SettingsApp } from './apps/SettingsApp';
import { SystemApp } from './apps/SystemApp';
import { TerminalApp } from './apps/TerminalApp';
import { YokaidoApp } from './apps/YokaidoApp';
import { windowLabels } from './window-labels';
import { WindowFrame } from './WindowFrame';

/**
 * Every window the layout owns, server-rendered with its full content, in
 * the order a document reads them (a case page's window comes before these).
 * `welcome` is passed in pre-rendered from the layout so it can also be
 * placed on the phone home screen without a second render.
 */
export async function OsWindows({ locale, welcome }: { locale: Locale; welcome: ReactNode }) {
  const [t, labels] = await Promise.all([getTranslations({ locale, namespace: 'os.apps' }), windowLabels(locale)]);

  const windows: [AppId, ReactNode][] = [
    ['welcome', welcome],
    ['about', <AboutApp key="about" locale={locale} />],
    ['projects', <ProjectsApp key="projects" locale={locale} />],
    ['yokaido', <YokaidoApp key="yokaido" locale={locale} />],
    ['activity', <ActivityApp key="activity" locale={locale} />],
    ['business', <BusinessApp key="business" locale={locale} />],
    ['contact', <ContactApp key="contact" locale={locale} />],
    ['terminal', <TerminalApp key="terminal" />],
    ['browser', <BrowserApp key="browser" />],
    ['system', <SystemApp key="system" locale={locale} />],
    ['settings', <SettingsApp key="settings" locale={locale} />],
  ];

  return windows.map(([id, content]) => (
    <WindowFrame key={id} id={id} title={t(`${getApp(id)!.messageKey}.title`)} labels={labels}>
      {content}
    </WindowFrame>
  ));
}
