import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ProjectSlug } from '@/content/projects';
import { localizedPath } from './localized-path';
import { openGraph } from './open-graph';
import { projectMessageKey } from './project-message-key';
import type { Locale } from './routing';

/**
 * Title, description, hreflang alternates and Open Graph for a case page,
 * shared by the Spanish tree (/work/<slug>/) and the prefixed one (/ca/…,
 * /en/…). The page metadata replaces the layout's home-page alternates.
 */
export async function caseMetadata(locale: Locale, slug: ProjectSlug): Promise<Metadata> {
  const [t, tStudy] = await Promise.all([
    getTranslations({ locale, namespace: 'casePage' }),
    getTranslations({ locale, namespace: `caseStudies.${projectMessageKey[slug]}` }),
  ]);
  const path = `/work/${slug}/`;
  return {
    title: t('metaTitle', { title: tStudy('title') }),
    description: tStudy('summary'),
    alternates: {
      canonical: localizedPath(path, locale),
      languages: {
        es: localizedPath(path, 'es'),
        ca: localizedPath(path, 'ca'),
        en: localizedPath(path, 'en'),
        'x-default': localizedPath(path, 'es'),
      },
    },
    openGraph: openGraph(locale, localizedPath(path, locale), 'article'),
  };
}
