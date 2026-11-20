import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { projects } from '@/content/projects';
import { activitySources } from './activity-sources';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('activity sources', () => {
  it('name one repo for every featured project, in index order', () => {
    expect(activitySources.map((source) => source.slug)).toEqual(projects.map((p) => p.slug));
  });

  it('read rally voley from its working branch (spec §4)', () => {
    const rally = activitySources.find((source) => source.slug === 'rally-voley');
    expect(rally?.branch).toBe('feat/milestone-1');
  });

  // Spec §4 privacy: repo and branch names are build-only. Pages, layouts and
  // components may not import them, so they can never reach a bundle.
  it('stay out of the app and its components', () => {
    const importers = [
      ...sourceFiles(join(SRC, 'app')),
      ...sourceFiles(join(SRC, 'components')),
      ...sourceFiles(join(SRC, 'os')),
    ].filter(
      (file) => /from ['"][^'"]*(activity-sources|github-activity)['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(importers).toEqual([]);
  });

  it('are not part of the project content', () => {
    for (const project of projects) expect(Object.keys(project)).not.toContain('repo');
  });
});
