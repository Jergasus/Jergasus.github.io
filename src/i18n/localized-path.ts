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
  /**
   * Collapses any run of leading `/` and `\` characters to a single `/`,
   * so the result always starts with exactly one `/` followed by a
   * non-slash, non-backslash character (or is exactly `/`).
   */
  const normalise = (p: string): string => '/' + p.replace(/^[/\\]+/, '');

  // First normalise — prevents double-slash inputs like //evil.com/ from
  // sneaking through the locale-prefix check as a leading // sequence.
  const safe = normalise(pathname);

  // Strip /ca or /en prefix to reach the canonical path.
  let canonical = safe;
  if (safe.startsWith('/ca/')) canonical = safe.slice(3);
  else if (safe.startsWith('/en/')) canonical = safe.slice(3);
  if (!canonical) canonical = '/';

  // Second normalise — a double-slash hidden AFTER a locale prefix
  // (e.g. '/en//evil.com/' → strip '/en' → '//evil.com/') would otherwise
  // survive the slice and become a protocol-relative open redirect.
  canonical = normalise(canonical);

  if (target === 'es') return canonical;
  return `/${target}${canonical}`;
}
