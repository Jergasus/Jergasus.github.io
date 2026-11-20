import { expect, test } from 'vitest';
import { barcelonaTime } from './clock';

test('formats Barcelona time in 24 h', () => {
  // 2026-07-01 20:05 UTC → CEST (UTC+2) → 22:05
  expect(barcelonaTime(new Date('2026-07-01T20:05:00Z'), 'es')).toBe('22:05');
});

test('formats Barcelona time in winter (UTC+1)', () => {
  // 2026-01-15 12:00 UTC → CET (UTC+1) → 13:00
  expect(barcelonaTime(new Date('2026-01-15T12:00:00Z'), 'es')).toBe('13:00');
});

test('zero-pads single-digit minutes', () => {
  // 2026-07-01 08:03 UTC → 10:03 Madrid
  expect(barcelonaTime(new Date('2026-07-01T08:03:00Z'), 'es')).toBe('10:03');
});

test('uses 24-h format: 23:00 not 11:00 PM', () => {
  // 2026-07-01 21:00 UTC → 23:00 Madrid (CEST)
  expect(barcelonaTime(new Date('2026-07-01T21:00:00Z'), 'en')).toBe('23:00');
});
