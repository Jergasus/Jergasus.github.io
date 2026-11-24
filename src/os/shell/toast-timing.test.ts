import { describe, test, expect } from 'vitest';
import { firstToastDelay } from './toast-timing';

describe('firstToastDelay', () => {
  test('the welcome gets 8 s, with or without the boot; otherwise today\'s delays', () => {
    expect(firstToastDelay({ boot: false, welcome: true })).toBe(8000);
    expect(firstToastDelay({ boot: true, welcome: true })).toBe(8000);
    expect(firstToastDelay({ boot: false, welcome: false })).toBe(1200);
    expect(firstToastDelay({ boot: true, welcome: false })).toBe(100);
  });
});
