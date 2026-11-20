import { projects } from '@/content/projects';

/**
 * Normalises an absolute URL string for allowlist comparison.
 *
 * - Parses via the WHATWG URL API so hostname case and trailing slashes are
 *   canonical: `https://PLAYQUESTDAY.COM` and `https://playquestday.com/`
 *   produce the same key.
 * - Returns `null` when the string is not a valid absolute https URL.
 *   Non-https schemes (`http:`, `javascript:`, `data:`, `blob:`, etc.) are
 *   always refused.
 */
function normalise(urlString: string): string | null {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Canonical set of live-project URLs the retro browser is allowed to load. */
const ALLOWED_URLS: ReadonlySet<string> = new Set(
  projects.flatMap((p) => {
    const n = p.liveUrl ? normalise(p.liveUrl) : null;
    return n !== null ? [n] : [];
  }),
);

/**
 * Returns `true` when `url` is one of the live project URLs the retro browser
 * may load.
 *
 * Uses `new URL()` normalisation so trailing-slash variants and hostname-case
 * variants of an allowed URL are accepted (e.g. `https://PLAYQUESTDAY.COM`
 * matches `https://playquestday.com`).
 *
 * Any non-`https:` scheme (`javascript:`, `http:`, `data:`, `blob:`, …) is
 * always refused.
 */
export function isAllowedBrowserUrl(url: string): boolean {
  const normalised = normalise(url);
  if (normalised === null) return false;
  return ALLOWED_URLS.has(normalised);
}
