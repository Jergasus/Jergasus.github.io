import type { ProjectSlug } from '@/content/projects';
import { projects } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import type { Status } from '@/lib/status';

// Server and build code only: client components get what they need as props
// and format dates with src/lib/dates.ts.

export interface RepoActivity {
  slug: ProjectSlug;
  totalCommits: number;
  lastCommitAt: string;
  weekly: number[];
}

export interface ActivitySnapshot {
  generatedAt: string;
  repos: RepoActivity[];
}

// ── Privacy whitelist (spec §4) ──────────────────────────────────────────────
// Only numbers and ISO dates may leave a private repo. Every snapshot passes
// through parseActivitySnapshot twice: before scripts/fetch-activity.ts writes
// it, and when the build reads data/activity.json. Anything else is dropped,
// and anything malformed throws, so a bad snapshot fails the build loudly.

const SLUGS: readonly ProjectSlug[] = projects.map((p) => p.slug);
const WEEKS = 26;
// What GitHub returns ("2026-11-04T18:00:00Z"): a full date-time, nothing else.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const isIsoDateTime = (value: unknown): value is string =>
  typeof value === 'string' && ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value));
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function sanitizeRepoActivity(x: unknown): RepoActivity {
  if (typeof x !== 'object' || x === null) {
    throw new Error('sanitizeRepoActivity: not an object');
  }
  const r = x as Record<string, unknown>;

  if (!SLUGS.includes(r.slug as ProjectSlug)) {
    throw new Error(`sanitizeRepoActivity: invalid slug "${String(r.slug)}"`);
  }
  if (!isCount(r.totalCommits)) {
    throw new Error(`sanitizeRepoActivity: invalid totalCommits for ${String(r.slug)}`);
  }
  if (!isIsoDateTime(r.lastCommitAt)) {
    throw new Error(`sanitizeRepoActivity: invalid lastCommitAt for ${String(r.slug)}`);
  }
  if (!Array.isArray(r.weekly) || r.weekly.length !== WEEKS || !r.weekly.every(isCount)) {
    throw new Error(`sanitizeRepoActivity: invalid weekly for ${String(r.slug)}`);
  }

  return {
    slug: r.slug as ProjectSlug,
    totalCommits: r.totalCommits,
    lastCommitAt: r.lastCommitAt,
    weekly: [...(r.weekly as number[])],
  };
}

/** Validates a snapshot and returns a copy holding only whitelisted keys. */
export function parseActivitySnapshot(raw: unknown): ActivitySnapshot {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid activity snapshot: not an object');
  }
  const s = raw as Record<string, unknown>;
  if (!isIsoDateTime(s.generatedAt)) {
    throw new Error('Invalid activity snapshot: generatedAt');
  }
  if (!Array.isArray(s.repos)) {
    throw new Error('Invalid activity snapshot: repos');
  }
  const repos = s.repos.map(sanitizeRepoActivity);
  const seen = new Set<ProjectSlug>();
  for (const repo of repos) {
    if (seen.has(repo.slug)) throw new Error(`Invalid activity snapshot: ${repo.slug} appears twice`);
    seen.add(repo.slug);
  }
  return { generatedAt: s.generatedAt, repos };
}

export function aggregate(s: ActivitySnapshot): {
  totalCommits: number;
  lastCommitAt: string;
  weekly: number[];
  mostRecentSlug: ProjectSlug;
} {
  let totalCommits = 0;
  const weekly = new Array<number>(26).fill(0);
  let lastCommitAt = '';
  let mostRecentSlug: ProjectSlug = 'questday';

  for (const r of s.repos) {
    totalCommits += r.totalCommits;
    for (let i = 0; i < 26; i++) {
      weekly[i] += r.weekly[i] ?? 0;
    }
    if (r.lastCommitAt > lastCommitAt) {
      lastCommitAt = r.lastCommitAt;
      mostRecentSlug = r.slug;
    }
  }

  return { totalCommits, lastCommitAt, weekly, mostRecentSlug };
}

export function resolveCurrentlyBuilding(
  status: Status,
  agg: ReturnType<typeof aggregate>,
  locale: Locale
): string {
  const line = status.currentlyBuilding[locale];
  if (line.trim() !== '') return line;
  const proj = projects.find((p) => p.slug === agg.mostRecentSlug);
  return proj?.name ?? (agg.mostRecentSlug as string);
}
