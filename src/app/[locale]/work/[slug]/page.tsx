import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing, type Locale } from '@/i18n/routing';
import { caseStudySlugs, isCaseStudySlug } from '@/content/projects';
import { caseMetadata } from '@/i18n/case-metadata';
import { CaseStudyPage } from '@/components/pages/CaseStudyPage';

// Spanish lives in the (es) tree, so this one builds ca and en only.
export const dynamicParams = false;

export function generateStaticParams() {
  return (['ca', 'en'] as const).flatMap((locale) =>
    caseStudySlugs.map((slug) => ({ locale, slug })),
  );
}

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !isCaseStudySlug(slug)) return {};
  return caseMetadata(locale, slug);
}

export default async function LocaleCasePage({ params }: Params) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !isCaseStudySlug(slug)) notFound();
  return <CaseStudyPage locale={locale as Locale} slug={slug} />;
}
