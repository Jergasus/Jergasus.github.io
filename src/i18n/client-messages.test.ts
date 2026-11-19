import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import es from '../../messages/es.json';
import { CLIENT_NAMESPACES, clientMessages } from './client-messages';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function clientComponents(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return clientComponents(path);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return /^\s*['"]use client['"]/.test(readFileSync(path, 'utf8')) ? [path] : [];
  });
}

describe('client messages', () => {
  it('carry only the client namespaces', () => {
    const picked = clientMessages(es);
    expect(Object.keys(picked)).toEqual([...CLIENT_NAMESPACES]);
    expect(picked.hero).toEqual(es.hero);
  });

  // Server components translate on the server; only what a client component
  // translates has to reach the browser. A client component reading another
  // namespace would show raw keys, so the list must cover every one of them.
  it('cover every namespace a client component translates', () => {
    const files = clientComponents(SRC);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} reads all messages`).not.toMatch(/useMessages\(|useTranslations\(\s*\)/);
      for (const [, namespace] of source.matchAll(/useTranslations\(\s*['"]([^'"]+)['"]/g)) {
        expect(CLIENT_NAMESPACES as readonly string[], file).toContain(namespace.split('.')[0]);
      }
    }
  });
});
