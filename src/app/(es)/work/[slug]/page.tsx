import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { caseStudySlugs, isCaseStudySlug } from '@/content/projects';
import { caseMetadata } from '@/i18n/case-metadata';
import { CaseStudyPage } from '@/components/pages/CaseStudyPage';

// Only the three case studies exist; anything else (Yokaido included) 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudySlugs.map((slug) => ({ slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!isCaseStudySlug(slug)) return {};
  return caseMetadata('es', slug);
}

export default async function EsCasePage({ params }: Params) {
  const { slug } = await params;
  if (!isCaseStudySlug(slug)) notFound();
  return <CaseStudyPage locale="es" slug={slug} />;
}
