import { describe, expect, it } from 'vitest';
import es from '../../messages/es.json';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj)
    .flatMap(([k, v]) =>
      v && typeof v === 'object'
        ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
        : [`${prefix}${k}`],
    )
    .sort();
}

describe('messages', () => {
  it('messages parity', () => {
    const esKeys = flatten(es);
    expect(flatten(ca)).toEqual(esKeys);
    expect(flatten(en)).toEqual(esKeys);
    for (const m of [es, ca, en]) {
      expect(JSON.stringify(m)).not.toMatch(/:""/);
    }
  });
});
