import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ProjectSlug } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { projectMessageKey } from '@/i18n/project-message-key';
import { isCaseApp } from './apps';
import { CaseApp } from './apps/CaseApp';
import { CaseKeeper } from './CaseKeeper';
import { windowLabels } from './window-labels';
import { WindowFrame } from './WindowFrame';

/** A case page's content: its project window, kept alive by the shell once the URL moves on. */
export async function CaseWindow({ locale, slug }: { locale: Locale; slug: ProjectSlug }) {
  if (!isCaseApp(slug)) throw new Error(`No case window for "${slug}"`);
  // next-intl's <Link> reads the request locale; pages render apart from layouts.
  setRequestLocale(locale);
  const [t, labels] = await Promise.all([getTranslations({ locale, namespace: 'os.apps' }), windowLabels(locale)]);

  return (
    <CaseKeeper slug={slug}>
      <WindowFrame id={slug} title={t(`${projectMessageKey[slug]}.title`)} labels={labels}>
        <CaseApp locale={locale} slug={slug} />
      </WindowFrame>
    </CaseKeeper>
  );
}
