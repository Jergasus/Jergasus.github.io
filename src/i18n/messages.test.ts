import { describe, expect, it } from 'vitest';
import { createTranslator } from 'next-intl';
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

/** Every string in a messages file with its path (array items by index). */
function leaves(node: unknown, path = ''): [path: string, value: string][] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) => leaves(value, path ? `${path}.${key}` : key));
  }
  return [];
}

/** The arguments a message takes: {name}, {total, number}, {count, plural, …}. */
const argumentsOf = (message: string) =>
  [...message.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map((match) => match[1]);
/** Its rich-text tags: <value>…</value>. */
const tagsOf = (message: string) => [...message.matchAll(/<(\w+)>/g)].map((match) => match[1]);

describe('messages', () => {
  it('messages parity', () => {
    const esKeys = flatten(es);
    expect(flatten(ca)).toEqual(esKeys);
    expect(flatten(en)).toEqual(esKeys);
    for (const m of [es, ca, en]) {
      expect(JSON.stringify(m)).not.toMatch(/:""/);
    }
  });

  it('the placeholder guard catches a quoted placeholder', () => {
    // In ICU MessageFormat an apostrophe before a brace starts a quoted
    // literal: "'{cmd}' no reconocido" prints {cmd} itself.
    const t = createTranslator({ locale: 'es', messages: { a: "'{cmd}' no reconocido", b: '«{cmd}» no reconocido' } });
    const values = { cmd: 'xyzzy' } as never;
    expect(t('a', values)).toBe('{cmd} no reconocido');
    expect(t('b', values)).toBe('«xyzzy» no reconocido');
  });

  // Formats every message the way next-intl renders it, with a value for each
  // argument: a placeholder that survives as text would show on the page, and
  // a message ICU cannot parse (a bare "<app>" reads as an unclosed tag) shows
  // its key instead.
  it('every message formats with its placeholders filled in', () => {
    for (const [locale, messages] of Object.entries({ es, ca, en })) {
      const errors: string[] = [];
      const t = createTranslator({ locale, messages, onError: (error) => errors.push(error.message) });
      for (const [path, message] of leaves(messages)) {
        const where = `${locale} ${path}`;
        expect(message, `${where}: straight apostrophe before a brace`).not.toMatch(/'\{/);
        const values = Object.fromEntries(argumentsOf(message).map((name) => [name, 1]));
        const tags = Object.fromEntries(tagsOf(message).map((tag) => [tag, (chunks: string) => chunks]));
        const text = tagsOf(message).length
          ? t.markup(path as never, { ...values, ...tags } as never)
          : t(path as never, values as never);
        expect(text, where).not.toMatch(/[{}]/);
      }
      expect(errors, locale).toEqual([]);
    }
  });
});
