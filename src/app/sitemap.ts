import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/content/site';
import { caseStudySlugs } from '@/content/projects';
import { localizedPath } from '@/i18n/localized-path';

export const dynamic = 'force-static';

const LOCALES = ['es', 'ca', 'en'] as const;

/**
 * Generates /sitemap.xml with the 12 public URLs:
 * 3 home pages (es, ca, en) + 3 case pages × 3 locales = 12.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const homeUrls: MetadataRoute.Sitemap = LOCALES.map((locale) => ({
    url: `${SITE_URL}${localizedPath('/', locale)}`,
    changeFrequency: 'monthly',
    priority: 1.0,
  }));

  const caseUrls: MetadataRoute.Sitemap = caseStudySlugs.flatMap((slug) =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}${localizedPath(`/work/${slug}/`, locale)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  );

  return [...homeUrls, ...caseUrls];
}
