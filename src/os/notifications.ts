import type { RepoActivity } from '@/lib/activity';
import type { ProjectSlug } from '@/content/projects';
import { isFresh } from '@/lib/dates';

/**
 * Derive desktop-notification data from recent repo activity.
 *
 * Returns repos sorted newest-first, capped at opts.max, and limited to
 * those whose lastCommitAt is within opts.maxAgeDays of now.
 *
 * Privacy: only `slug` and `lastCommitAt` are returned — no branch names,
 * commit messages or author information.
 */
export function commitNotifications(
  repos: Pick<RepoActivity, 'slug' | 'lastCommitAt'>[],
  now: Date,
  opts: { max: number; maxAgeDays: number },
): { slug: ProjectSlug; lastCommitAt: string }[] {
  return repos
    .filter((r) => isFresh(r.lastCommitAt, now, opts.maxAgeDays))
    .sort((a, b) => (b.lastCommitAt > a.lastCommitAt ? 1 : b.lastCommitAt < a.lastCommitAt ? -1 : 0))
    .slice(0, opts.max)
    .map((r) => ({ slug: r.slug, lastCommitAt: r.lastCommitAt }));
}
