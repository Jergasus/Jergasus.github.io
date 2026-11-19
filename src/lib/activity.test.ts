import { describe, it, expect } from 'vitest';
import {
  aggregate,
  parseActivitySnapshot,
  resolveCurrentlyBuilding,
  sanitizeRepoActivity,
} from './activity';
import type { ActivitySnapshot } from './activity';
import type { Status } from './status';
import { projects } from '@/content/projects';
import committed from '../../data/activity.json';

const repo = (slug: string) => ({
  slug,
  totalCommits: 3,
  lastCommitAt: '2026-11-04T18:00:00Z',
  weekly: new Array<number>(26).fill(0),
});

describe('sanitizeRepoActivity', () => {
  it('drops unknown keys', () => {
    const input = { ...repo('questday'), message: 'secret', files: ['README.md'] };
    const result = sanitizeRepoActivity(input);
    expect(Object.keys(result).sort()).toEqual(['lastCommitAt', 'slug', 'totalCommits', 'weekly']);
  });

  it('accepts only ISO dates, so no free text can ride along', () => {
    expect(() => sanitizeRepoActivity({ ...repo('questday'), lastCommitAt: 'fix: secret thing 2026' })).toThrow(
      'lastCommitAt',
    );
    expect(() => sanitizeRepoActivity({ ...repo('questday'), lastCommitAt: '2026-11-04' })).toThrow('lastCommitAt');
  });

  it('copies the weekly counts instead of keeping the caller array', () => {
    const input = repo('questday');
    expect(sanitizeRepoActivity(input).weekly).not.toBe(input.weekly);
  });
});

describe('parseActivitySnapshot', () => {
  it('accepts the committed snapshot', () => {
    expect(parseActivitySnapshot(committed).repos).toHaveLength(committed.repos.length);
  });

  it('keeps only whitelisted keys, at the top and in each repo', () => {
    const parsed = parseActivitySnapshot({
      generatedAt: '2026-11-18T00:00:00Z',
      token: 'ghp_secret',
      repos: [{ ...repo('questday'), branch: 'feat/secret' }],
    });
    expect(Object.keys(parsed).sort()).toEqual(['generatedAt', 'repos']);
    expect(Object.keys(parsed.repos[0]).sort()).toEqual(['lastCommitAt', 'slug', 'totalCommits', 'weekly']);
  });

  it('throws on an invalid snapshot so the build fails loudly', () => {
    expect(() => parseActivitySnapshot(null)).toThrow('activity snapshot');
    expect(() => parseActivitySnapshot({ generatedAt: 'yesterday', repos: [] })).toThrow('generatedAt');
    expect(() => parseActivitySnapshot({ generatedAt: '2026-11-18T00:00:00Z', repos: {} })).toThrow('repos');
    expect(() =>
      parseActivitySnapshot({ generatedAt: '2026-11-18T00:00:00Z', repos: [repo('not-a-project')] }),
    ).toThrow('slug');
    expect(() =>
      parseActivitySnapshot({
        generatedAt: '2026-11-18T00:00:00Z',
        repos: [repo('questday'), repo('questday')],
      }),
    ).toThrow('questday');
  });
});

function makeSnapshot(): ActivitySnapshot {
  return {
    generatedAt: '2026-11-18T00:00:00Z',
    repos: [
      {
        slug: 'questday',
        totalCommits: 495,
        lastCommitAt: '2026-11-04T18:00:00Z',
        // weekly[25]=1 (all 1s, except index 24 which is 3)
        weekly: Array.from({ length: 26 }, (_, i) => (i === 24 ? 3 : 1)),
      },
      {
        slug: 'sakurai',
        totalCommits: 281,
        lastCommitAt: '2026-11-17T18:00:00Z',
        // weekly[25]=4 (all 2s, except index 25 which is 4)
        weekly: Array.from({ length: 26 }, (_, i) => (i === 25 ? 4 : 2)),
      },
      {
        slug: 'rally-voley',
        totalCommits: 247,
        lastCommitAt: '2026-11-13T18:00:00Z',
        weekly: new Array<number>(26).fill(5),
      },
      {
        slug: 'yokaido',
        totalCommits: 143,
        lastCommitAt: '2026-11-02T18:00:00Z',
        // weekly[23]=3, all others 0
        weekly: Array.from({ length: 26 }, (_, i) => (i === 23 ? 3 : 0)),
      },
    ],
  };
}

describe('aggregate', () => {
  it('sums totalCommits, weekly element-wise, and picks max lastCommitAt', () => {
    const agg = aggregate(makeSnapshot());

    expect(agg.totalCommits).toBe(495 + 281 + 247 + 143);

    // weekly[25]: questday=1, sakurai=4, rally-voley=5, yokaido=0 → 10
    expect(agg.weekly[25]).toBe(1 + 4 + 5 + 0);
    expect(agg.weekly).toHaveLength(26);

    // max lastCommitAt is sakurai's 2026-11-17T18:00:00Z
    expect(agg.lastCommitAt).toBe('2026-11-17T18:00:00Z');
    expect(agg.mostRecentSlug).toBe('sakurai');
  });
});

describe('resolveCurrentlyBuilding', () => {
  it('returns status line when non-empty', () => {
    const status: Status = {
      available: true,
      availabilityLabel: { es: 'Disponible', ca: 'Disponible', en: 'Available' },
      currentlyBuilding: {
        es: 'Construyendo algo',
        ca: 'Construint alguna cosa',
        en: 'Building something',
      },
    };
    const agg = aggregate(makeSnapshot());
    expect(resolveCurrentlyBuilding(status, agg, 'es')).toBe('Construyendo algo');
  });

  it('falls back to project name when status line is empty', () => {
    const status: Status = {
      available: true,
      availabilityLabel: { es: 'Disponible', ca: 'Disponible', en: 'Available' },
      currentlyBuilding: { es: '', ca: '', en: '' },
    };
    const agg = aggregate(makeSnapshot());
    // mostRecentSlug is 'sakurai' (Nov 17 is max lastCommitAt)
    const sakuraiProject = projects.find((p) => p.slug === 'sakurai')!;
    expect(resolveCurrentlyBuilding(status, agg, 'es')).toBe(sakuraiProject.name);
  });
});
