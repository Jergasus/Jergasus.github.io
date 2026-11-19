import type { ProjectSlug } from '@/content/projects';
import {
  parseActivitySnapshot,
  sanitizeRepoActivity,
  type ActivitySnapshot,
  type RepoActivity,
} from './activity';
import { activitySources, type ActivitySource } from './activity-sources';

// Build-time only: run by scripts/fetch-activity.ts in the deploy workflow.
// Its warnings land in the public Actions log, so they name projects by slug
// and never print a branch name (spec §4 privacy).

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKS = 26;

/** The branch a source falls back to once its configured branch is gone. */
const FALLBACK_BRANCH = 'main';

/** A GitHub API answer other than 2xx; `status` tells a gone branch (404) apart. */
export class GitHubHttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'GitHubHttpError';
  }
}

function parseLinkLastPage(link: string | null): number | null {
  if (!link) return null;
  const match = link.match(/<[^>]*[?&]page=(\d+)[^>]*>\s*;\s*rel="last"/);
  return match ? parseInt(match[1], 10) : null;
}

function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  const match = link.match(/<([^>]+)>\s*;\s*rel="next"/);
  return match ? match[1] : null;
}

export async function fetchRepoActivity(
  source: ActivitySource,
  opts: { token: string; now: Date; fetchImpl?: typeof fetch }
): Promise<RepoActivity> {
  const f = opts.fetchImpl ?? fetch;
  const { owner, name, branch } = source;
  const encodedBranch = encodeURIComponent(branch);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Step 1: Total commits count + lastCommitAt
  const totalUrl = `https://api.github.com/repos/${owner}/${name}/commits?sha=${encodedBranch}&per_page=1`;
  const totalRes = await f(totalUrl, { headers });
  if (!totalRes.ok) {
    throw new GitHubHttpError(totalRes.status, `GitHub API ${totalRes.status} for ${source.slug}`);
  }

  const totalData = (await totalRes.json()) as Array<{
    commit: { committer: { date: string } };
  }>;
  // No commits means no numbers: fail (the caller keeps the last known ones)
  // rather than invent a commit "now".
  if (!Array.isArray(totalData) || totalData.length === 0) {
    throw new Error(`no commits found for ${source.slug}`);
  }
  const lastCommitAt = totalData[0].commit.committer.date;
  // Without a rel="last" link the whole history fits on this one-commit page.
  const totalCommits = parseLinkLastPage(totalRes.headers.get('Link')) ?? totalData.length;

  // Step 2: Weekly buckets — last 182 days (26 × 7)
  const weekly = new Array<number>(WEEKS).fill(0);
  const since = new Date(opts.now.getTime() - WEEKS * WEEK_MS).toISOString();

  let url: string | null =
    `https://api.github.com/repos/${owner}/${name}/commits?sha=${encodedBranch}&since=${since}&per_page=100`;

  while (url) {
    const res = await f(url, { headers });
    if (!res.ok) {
      throw new GitHubHttpError(res.status, `GitHub API ${res.status} for ${source.slug} (weekly)`);
    }

    const commits = (await res.json()) as Array<{
      commit: { committer: { date: string } };
    }>;

    for (const c of commits) {
      const ms = opts.now.getTime() - new Date(c.commit.committer.date).getTime();
      const k = Math.floor(ms / WEEK_MS);
      if (k >= 0 && k < WEEKS) {
        weekly[WEEKS - 1 - k]++;
      }
    }

    url = parseNextLink(res.headers.get('Link'));
  }

  return { slug: source.slug, totalCommits, lastCommitAt, weekly };
}

/**
 * Moves a repo's weekly counts from the window that ended at `from` to the
 * one ending at `to`: weeks that fell out of the window drop off the front,
 * and the new recent weeks, which nobody counted, are zero. Accurate to the
 * week.
 */
export function realignWeekly(weekly: readonly number[], from: string, to: Date): number[] {
  const weeks = Math.min(Math.floor((to.getTime() - Date.parse(from)) / WEEK_MS), weekly.length);
  if (!(weeks > 0)) return [...weekly];
  return [...weekly.slice(weeks), ...new Array<number>(weeks).fill(0)];
}

export type FetchActivityResult = 'updated' | 'partial' | 'kept-snapshot';

/**
 * Whether the run's activity-health job should fail (ruling R18): a fetch
 * failed (auth, HTTP, network or an empty branch), so the site went out with
 * older numbers. A missing token only warns: that is the state before the
 * token exists, and the committed snapshot is what it is meant to show.
 */
export function refreshFailed(result: FetchActivityResult, tokenSet: boolean): boolean {
  return result === 'partial' || (result === 'kept-snapshot' && tokenSet);
}

type FetchRepo = (
  source: ActivitySource,
  opts: { token: string; now: Date; fetchImpl?: typeof fetch }
) => Promise<RepoActivity>;

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Refreshes the activity snapshot, one repo at a time (spec §4 Failure):
 * - every repo fetched: writes the new snapshot ('updated');
 * - some failed: each failed repo keeps its entry from the committed
 *   snapshot, realigned to the new end date, and the rest update ('partial');
 * - all failed, or no token: writes nothing ('kept-snapshot').
 * A configured branch that is gone (404) is retried once on main. Every
 * entry goes through the privacy whitelist before it is written.
 */
export async function runFetchActivity(deps: {
  token: string | undefined;
  now: Date;
  fetchImpl?: typeof fetch;
  /** Fetches one repo; fetchRepoActivity unless a test stands in. */
  fetchRepo?: FetchRepo;
  readSnapshot: () => Promise<ActivitySnapshot>;
  writeSnapshot: (s: ActivitySnapshot) => Promise<void>;
  /** Warnings; the script turns them into workflow annotations. */
  warn: (msg: string) => void;
}): Promise<FetchActivityResult> {
  const sources = activitySources;
  // Belt and braces for the public log: no message ever carries a branch name.
  const branches = sources.map((s) => s.branch).filter((b) => b !== FALLBACK_BRANCH);
  const warn = (msg: string) =>
    deps.warn(
      branches.reduce(
        (text, branch) =>
          text.replaceAll(branch, '<branch>').replaceAll(encodeURIComponent(branch), '<branch>'),
        msg
      )
    );

  if (!deps.token) {
    warn('ACTIVITY_TOKEN is not set, so the committed activity snapshot stays as it is.');
    return 'kept-snapshot';
  }

  const fetchRepo = deps.fetchRepo ?? fetchRepoActivity;
  const opts = { token: deps.token, now: deps.now, fetchImpl: deps.fetchImpl };

  const fetchSource = async (source: ActivitySource): Promise<RepoActivity> => {
    try {
      return sanitizeRepoActivity(await fetchRepo(source, opts));
    } catch (error) {
      const branchGone =
        error instanceof GitHubHttpError && error.status === 404 && source.branch !== FALLBACK_BRANCH;
      if (!branchGone) throw error;
      const entry = sanitizeRepoActivity(await fetchRepo({ ...source, branch: FALLBACK_BRANCH }, opts));
      warn(
        `${source.slug}: its configured branch was not found (404), so its activity now comes from ` +
          `${FALLBACK_BRANCH}. Update its branch in src/lib/activity-sources.ts.`
      );
      return entry;
    }
  };

  const settled = await Promise.allSettled(sources.map(fetchSource));
  const fresh = new Map<ProjectSlug, RepoActivity>();
  const failed: ProjectSlug[] = [];
  settled.forEach((outcome, i) => {
    const { slug } = sources[i];
    if (outcome.status === 'fulfilled') {
      fresh.set(slug, outcome.value);
    } else {
      failed.push(slug);
      warn(`${slug}: activity fetch failed (${describe(outcome.reason)}).`);
    }
  });

  if (fresh.size === 0) {
    warn('Every activity fetch failed, so the committed activity snapshot stays as it is.');
    return 'kept-snapshot';
  }

  let previous: ActivitySnapshot | null = null;
  if (failed.length > 0) {
    try {
      previous = await deps.readSnapshot();
    } catch (error) {
      warn(`The committed activity snapshot could not be read (${describe(error)}).`);
    }
  }

  const repos = sources.flatMap((source): RepoActivity[] => {
    const entry = fresh.get(source.slug);
    if (entry) return [entry];
    const kept = previous?.repos.find((r) => r.slug === source.slug);
    if (!previous || !kept) {
      warn(`${source.slug}: no earlier numbers to keep, so it is left out of the snapshot.`);
      return [];
    }
    warn(`${source.slug}: keeping its numbers from the snapshot of ${previous.generatedAt}.`);
    return [{ ...kept, weekly: realignWeekly(kept.weekly, previous.generatedAt, deps.now) }];
  });

  // The privacy whitelist, once more over the whole snapshot.
  await deps.writeSnapshot(parseActivitySnapshot({ generatedAt: deps.now.toISOString(), repos }));
  return failed.length > 0 ? 'partial' : 'updated';
}
