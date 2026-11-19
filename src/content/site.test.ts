import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL, SITE_URL, siteUrlFromCname } from './site';

describe('site url', () => {
  it('is the GitHub Pages address without a CNAME file', () => {
    expect(siteUrlFromCname(null)).toBe('https://jergasus.github.io');
    expect(siteUrlFromCname('  \n')).toBe('https://jergasus.github.io');
    expect(DEFAULT_SITE_URL).toBe('https://jergasus.github.io');
  });

  it('follows the custom domain in public/CNAME', () => {
    expect(siteUrlFromCname('jesusgarcia.dev\n')).toBe('https://jesusgarcia.dev');
    expect(siteUrlFromCname('WWW.Example.com')).toBe('https://www.example.com');
  });

  it('refuses a CNAME file that is not one bare hostname', () => {
    for (const bad of ['https://example.com', 'example.com/work', 'example', 'a.com\nb.com', 'exa mple.com']) {
      expect(() => siteUrlFromCname(bad), bad).toThrow('public/CNAME');
    }
  });

  it('is what the committed files say', () => {
    const cname = fileURLToPath(new URL('../../public/CNAME', import.meta.url));
    if (!existsSync(cname)) expect(SITE_URL).toBe(DEFAULT_SITE_URL);
    else expect(SITE_URL).not.toBe(DEFAULT_SITE_URL);
  });
});
