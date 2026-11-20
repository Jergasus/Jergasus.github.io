import { isCaseStudySlug } from '@/content/projects';
import type { CaseAppId } from './apps';

const PREFIXED = new Set(['ca', 'en']);

/**
 * The project a URL routes to: the last segment of /work/<slug>/ (optionally
 * under /ca or /en) when it is a case study, else null. The routed project's
 * window is the one the page itself renders.
 */
export function routedSlugOf(pathname: string | null): CaseAppId | null {
  const parts = (pathname ?? '').split('/').filter(Boolean);
  if (PREFIXED.has(parts[0])) parts.shift();
  if (parts.length !== 2 || parts[0] !== 'work') return null;
  return isCaseStudySlug(parts[1]) ? (parts[1] as CaseAppId) : null;
}

/** The URL for a project window, or home: the next-intl router adds the locale prefix. */
export function caseHref(slug: CaseAppId | null): string {
  return slug ? `/work/${slug}/` : '/';
}
