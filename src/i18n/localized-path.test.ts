import { describe, expect, it } from 'vitest';
import { localizedPath } from './localized-path';

describe('localizedPath', () => {
  it('converts / to each locale', () => {
    expect(localizedPath('/', 'es')).toBe('/');
    expect(localizedPath('/', 'ca')).toBe('/ca/');
    expect(localizedPath('/', 'en')).toBe('/en/');
  });

  it('converts /ca/ to each locale', () => {
    expect(localizedPath('/ca/', 'es')).toBe('/');
    expect(localizedPath('/ca/', 'ca')).toBe('/ca/');
    expect(localizedPath('/ca/', 'en')).toBe('/en/');
  });

  it('converts /en/ to each locale', () => {
    expect(localizedPath('/en/', 'es')).toBe('/');
    expect(localizedPath('/en/', 'ca')).toBe('/ca/');
    expect(localizedPath('/en/', 'en')).toBe('/en/');
  });

  it('converts /en/work/questday/ to each locale', () => {
    expect(localizedPath('/en/work/questday/', 'es')).toBe('/work/questday/');
    expect(localizedPath('/en/work/questday/', 'ca')).toBe('/ca/work/questday/');
    expect(localizedPath('/en/work/questday/', 'en')).toBe('/en/work/questday/');
  });

  it('converts /work/questday/ (Spanish, no prefix) to each locale', () => {
    expect(localizedPath('/work/questday/', 'es')).toBe('/work/questday/');
    expect(localizedPath('/work/questday/', 'ca')).toBe('/ca/work/questday/');
    expect(localizedPath('/work/questday/', 'en')).toBe('/en/work/questday/');
  });

  it('never produces a protocol-relative URL from a double-slash path', () => {
    // A pathname starting with // must be canonicalised to a single-slash path
    // so the href can never be interpreted as //host (open redirect).
    const result_es = localizedPath('//evil.com/x/', 'es');
    const result_ca = localizedPath('//evil.com/x/', 'ca');
    const result_en = localizedPath('//evil.com/x/', 'en');
    expect(result_es).not.toMatch(/^\/\//);
    expect(result_ca).not.toMatch(/^\/\//);
    expect(result_en).not.toMatch(/^\/\//);
    expect(result_en).toMatch(/^\/en\//);
    expect(result_ca).toMatch(/^\/ca\//);
    expect(result_es).toMatch(/^\//);
  });
});
