import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Canonical site URL: every absolute URL in the site (canonical, hreflang,
 * Open Graph, sitemap, robots) derives from it.
 *
 * GitHub Pages serves a custom domain from the one hostname in public/CNAME,
 * so moving to one needs only that file: the URL follows it. Without the
 * file it is the GitHub Pages address.
 *
 * Build and server code only (it reads the file system at build time); a
 * client component must never import it.
 */
export const DEFAULT_SITE_URL = 'https://jergasus.github.io';

// One DNS hostname: dot-separated labels of letters, digits and inner hyphens.
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function siteUrlFromCname(cname: string | null): string {
  const host = cname?.trim() ?? '';
  if (host === '') return DEFAULT_SITE_URL;
  if (!HOSTNAME.test(host)) {
    throw new Error(`public/CNAME must hold one bare hostname (like example.com), found "${host}"`);
  }
  return `https://${host.toLowerCase()}`;
}

function readCname(): string | null {
  // The build, the tests and the scripts all run from the project root.
  const path = join(process.cwd(), 'public', 'CNAME');
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

export const SITE_URL = siteUrlFromCname(readCname());

/** The site's name, as share cards show it (og:site_name). */
export const SITE_NAME = 'Jesús García';
