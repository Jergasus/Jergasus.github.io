import type { Locale } from './routing';

/**
 * Given any path in this site (with or without a locale prefix) and a target
 * locale, returns the equivalent path in that locale.
 *
 * Rules (trailingSlash: true, localePrefix: 'as-needed'):
 *   Spanish paths carry no prefix:  /work/questday/
 *   Catalan paths carry /ca prefix: /ca/work/questday/
 *   English paths carry /en prefix: /en/work/questday/
 */
export function localizedPath(pathname: string, target: Locale): string {
  // Strip /ca or /en prefix to reach the canonical path.
  let canonical = pathname;
  if (pathname.startsWith('/ca/')) canonical = pathname.slice(3);
  else if (pathname.startsWith('/en/')) canonical = pathname.slice(3);
  if (!canonical) canonical = '/';

  if (target === 'es') return canonical;
  return `/${target}${canonical}`;
}
