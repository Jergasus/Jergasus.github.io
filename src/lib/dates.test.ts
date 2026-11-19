import { describe, it, expect } from 'vitest';
import { formatDate, formatRelative, isFresh } from './dates';

describe('isFresh', () => {
  it('13 days → true', () => {
    const now = new Date('2026-11-18T00:00:00Z');
    const iso = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000).toISOString();
    expect(isFresh(iso, now)).toBe(true);
  });

  it('15 days → false', () => {
    const now = new Date('2026-11-18T00:00:00Z');
    const iso = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
    expect(isFresh(iso, now)).toBe(false);
  });
});

describe('formatRelative (R9)', () => {
  it('3 days ago → es hace 3 días, ca fa 3 dies, en 3 days ago', () => {
    const now = new Date('2026-11-18T00:00:00Z');
    const iso = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(iso, now, 'es')).toBe('hace 3 días');
    expect(formatRelative(iso, now, 'ca')).toBe('fa 3 dies');
    expect(formatRelative(iso, now, 'en')).toBe('3 days ago');
  });

  it('1 day ago → ayer / ahir / yesterday', () => {
    const now = new Date('2026-11-18T00:00:00Z');
    const iso = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(iso, now, 'es')).toBe('ayer');
    expect(formatRelative(iso, now, 'ca')).toBe('ahir');
    expect(formatRelative(iso, now, 'en')).toBe('yesterday');
  });
});

describe('formatDate', () => {
  it('writes the long date in each locale', () => {
    const iso = '2026-11-18T00:00:00Z';
    expect(formatDate(iso, 'es', 'long')).toBe('18 de noviembre de 2026');
    expect(formatDate(iso, 'ca', 'long')).toBe('18 de novembre del 2026');
    expect(formatDate(iso, 'en', 'long')).toBe('November 18, 2026');
  });

  it('reads the date in Madrid, whatever the machine', () => {
    // 23:30 UTC on the 17th is already the 18th in Madrid.
    expect(formatDate('2026-11-17T23:30:00Z', 'es', 'long')).toBe('18 de noviembre de 2026');
  });
});
