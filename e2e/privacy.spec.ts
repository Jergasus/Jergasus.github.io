import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test, expect } from '@playwright/test';

// Spec §4 privacy: from the private repos, only numbers and ISO dates may
// reach the site. The repo config (owner, repo names, the branch Rally Voley
// is built on) is build-only, so the whole export is scanned for it: HTML,
// the RSC payloads and every client chunk. Project slugs in public URLs
// (/work/questday/) are fine; repo identifiers are not.
const OUT = join(process.cwd(), 'out');
const TEXT_FILE = /\.(html|js|txt|json|xml|css|map|webmanifest)$/;

function textFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return textFiles(path);
    return TEXT_FILE.test(entry.name) ? [path] : [];
  });
}

const LEAKS: [label: string, pattern: RegExp][] = [
  ['a branch name', /milestone/i],
  ['a branch field', /\bbranch["']?\s*:\s*["'`]/],
  ['a repo object', /\brepo["']?\s*:\s*\{/],
  ['a repo owner field', /\bowner["']?\s*:\s*["'`]Jergasus/],
  ['a private repo path', /Jergasus\/(questday|SakurAI|rally-voley|Yokaido)\b/i],
  ['the GitHub API', /api\.github\.com/],
];

test('the build output carries no repo or branch identifiers', () => {
  const files = textFiles(OUT);
  // A scan of nothing would pass vacuously.
  expect(files.some((file) => file.endsWith('index.html'))).toBe(true);
  expect(files.some((file) => file.includes('/_next/static/') && file.endsWith('.js'))).toBe(true);

  const found = files.flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return LEAKS.filter(([, pattern]) => pattern.test(text)).map(
      ([label]) => `${relative(OUT, file)}: ${label}`,
    );
  });
  expect(found).toEqual([]);
});
