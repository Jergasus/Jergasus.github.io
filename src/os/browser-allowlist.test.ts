import { describe, expect, it } from 'vitest';
import { projects } from '@/content/projects';
import { isAllowedBrowserUrl } from './browser-allowlist';

const liveUrls = projects.filter((p) => p.liveUrl !== null).map((p) => p.liveUrl!);

// Grab a known live URL for variant tests (questday).
const questdayUrl = projects.find((p) => p.slug === 'questday')!.liveUrl!;
// https://playquestday.com

describe('isAllowedBrowserUrl', () => {
  // ── Accepted: exact project live URLs ──────────────────────────────────────

  describe('accepts each project live URL exactly', () => {
    it.each(liveUrls)('%s', (url) => {
      expect(isAllowedBrowserUrl(url)).toBe(true);
    });
  });

  // ── Accepted: normalised variants ─────────────────────────────────────────

  it('accepts trailing-slash variant (https://playquestday.com/)', () => {
    // The URL API normalises both to https://playquestday.com/, so they match.
    expect(isAllowedBrowserUrl(`${questdayUrl}/`)).toBe(true);
  });

  it('accepts uppercase-hostname variant (https://PLAYQUESTDAY.COM)', () => {
    const upper = questdayUrl.replace('https://', 'https://').toUpperCase();
    expect(isAllowedBrowserUrl(upper.replace('HTTPS://', 'https://'))).toBe(true);
  });

  it('accepts full uppercase URL (hostname portion normalised by URL API)', () => {
    // new URL('https://PLAYQUESTDAY.COM').hostname === 'playquestday.com'
    expect(isAllowedBrowserUrl('https://PLAYQUESTDAY.COM')).toBe(true);
  });

  // ── Refused: wrong host ────────────────────────────────────────────────────

  it('refuses https://www.google.com', () => {
    expect(isAllowedBrowserUrl('https://www.google.com')).toBe(false);
  });

  it('refuses a similar-looking but unlisted domain', () => {
    expect(isAllowedBrowserUrl('https://playquestday.net')).toBe(false);
  });

  it('refuses subdomain of an allowed host', () => {
    expect(isAllowedBrowserUrl('https://app.playquestday.com')).toBe(false);
  });

  it('refuses an allowed host without www when stored form uses www (sakurai)', () => {
    // projects has https://www.getsakurai.com; without www is a different URL.
    expect(isAllowedBrowserUrl('https://getsakurai.com')).toBe(false);
  });

  // ── Refused: wrong scheme ──────────────────────────────────────────────────

  it('refuses javascript: URL', () => {
    expect(isAllowedBrowserUrl('javascript:alert(1)')).toBe(false);
  });

  it('refuses http: variant of an allowed https: URL', () => {
    expect(isAllowedBrowserUrl('http://playquestday.com')).toBe(false);
  });

  it('refuses data: URL', () => {
    expect(isAllowedBrowserUrl('data:text/html,<h1>XSS</h1>')).toBe(false);
  });

  it('refuses blob: URL', () => {
    expect(isAllowedBrowserUrl('blob:https://playquestday.com/fake')).toBe(false);
  });

  // ── Refused: invalid or relative ──────────────────────────────────────────

  it('refuses empty string', () => {
    expect(isAllowedBrowserUrl('')).toBe(false);
  });

  it('refuses relative path', () => {
    expect(isAllowedBrowserUrl('/work/questday/')).toBe(false);
  });

  it('refuses plain hostname without scheme', () => {
    expect(isAllowedBrowserUrl('playquestday.com')).toBe(false);
  });

  it('refuses non-URL garbage', () => {
    expect(isAllowedBrowserUrl('not a url at all')).toBe(false);
  });
});
