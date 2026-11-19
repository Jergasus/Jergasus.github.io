import { describe, it, expect, vi } from 'vitest';
import {
  GitHubHttpError,
  fetchRepoActivity,
  realignWeekly,
  refreshFailed,
  runFetchActivity,
} from './github-activity';
import { activitySources, type ActivitySource } from './activity-sources';
import type { ActivitySnapshot, RepoActivity } from './activity';

function makeResponse(
  body: unknown,
  headers: Record<string, string> = {},
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-18T00:00:00Z');
const questday = activitySources.find((p) => p.slug === 'questday')!;
const rallyVoley = activitySources.find((p) => p.slug === 'rally-voley')!;
const asFetch = (mock: unknown) => mock as typeof fetch;

/** A fetch that answers every commits request with one commit a day ago. */
const oneCommitFetch = () =>
  vi.fn().mockImplementation(() =>
    Promise.resolve(makeResponse([{ commit: { committer: { date: '2026-11-17T00:00:00Z' } } }]))
  );

const repoEntry = (slug: RepoActivity['slug'], totalCommits: number, weekly = 0): RepoActivity => ({
  slug,
  totalCommits,
  lastCommitAt: '2026-11-10T12:00:00Z',
  weekly: new Array<number>(26).fill(weekly),
});

const previousSnapshot: ActivitySnapshot = {
  generatedAt: NOW.toISOString(),
  repos: [
    repoEntry('questday', 400, 1),
    repoEntry('sakurai', 200, 2),
    repoEntry('rally-voley', 100, 3),
    repoEntry('yokaido', 50, 4),
  ],
};

function deps(overrides: Partial<Parameters<typeof runFetchActivity>[0]> = {}) {
  const writeSnapshot = vi.fn<(s: ActivitySnapshot) => Promise<void>>().mockResolvedValue();
  const warn = vi.fn<(msg: string) => void>();
  return {
    writeSnapshot,
    warn,
    input: {
      token: 'test-token',
      now: NOW,
      readSnapshot: async () => previousSnapshot,
      writeSnapshot,
      warn,
      ...overrides,
    },
  };
}

describe('fetchRepoActivity', () => {
  it('reads total from Link last page', async () => {
    // Use mockImplementation so a fresh Response is created on every call
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        makeResponse(
          [{ commit: { committer: { date: '2026-11-04T18:00:00Z' } } }],
          {
            Link: '<https://api.github.com/repos/Jergasus/questday/commits?per_page=1&page=495>; rel="last"',
          }
        )
      )
    );

    const result = await fetchRepoActivity(questday, {
      token: 'test-token',
      now: NOW,
      fetchImpl: asFetch(fetchMock),
    });

    expect(result.totalCommits).toBe(495);
  });

  it('uses URL-encoded branch for Rally Voley (sha=feat%2Fmilestone-1)', async () => {
    const fetchMock = oneCommitFetch();

    await fetchRepoActivity(rallyVoley, {
      token: 'test-token',
      now: NOW,
      fetchImpl: asFetch(fetchMock),
    });

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('sha=feat%2Fmilestone-1'))).toBe(true);
  });

  it('weekly buckets: commits at now-1d, now-8d, now-8d', async () => {
    const minus1d = new Date(NOW.getTime() - 1 * DAY).toISOString();
    const minus8d = new Date(NOW.getTime() - 8 * DAY).toISOString();

    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: total (per_page=1) — single commit, no Link header
        return Promise.resolve(
          makeResponse([{ commit: { committer: { date: minus1d } } }])
        );
      }
      // Subsequent calls: weekly page — 3 commits, no next Link
      return Promise.resolve(
        makeResponse([
          { commit: { committer: { date: minus1d } } },
          { commit: { committer: { date: minus8d } } },
          { commit: { committer: { date: minus8d } } },
        ])
      );
    });

    const result = await fetchRepoActivity(questday, {
      token: 'test-token',
      now: NOW,
      fetchImpl: asFetch(fetchMock),
    });

    expect(result.weekly).toHaveLength(26);
    expect(result.weekly[25]).toBe(1); // minus1d → k=0 → weekly[25]
    expect(result.weekly[24]).toBe(2); // minus8d → k=1 → weekly[24]
  });

  it('a single commit without a Link header counts as exactly one', async () => {
    const result = await fetchRepoActivity(questday, {
      token: 'test-token',
      now: NOW,
      fetchImpl: asFetch(oneCommitFetch()),
    });
    expect(result.totalCommits).toBe(1);
    expect(result.lastCommitAt).toBe('2026-11-17T00:00:00Z');
  });

  // M9: no commits means no data, never "1 commit, just now".
  it('throws on a branch with no commits instead of inventing one', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(makeResponse([])));
    await expect(
      fetchRepoActivity(questday, { token: 'test-token', now: NOW, fetchImpl: asFetch(fetchMock) })
    ).rejects.toThrow('no commits');
  });

  it('reports the HTTP status of a failed request (409: empty repository)', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(makeResponse({ message: 'Git Repository is empty.' }, {}, 409))
      );
    const error = await fetchRepoActivity(questday, {
      token: 'test-token',
      now: NOW,
      fetchImpl: asFetch(fetchMock),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubHttpError);
    expect((error as GitHubHttpError).status).toBe(409);
  });
});

describe('realignWeekly', () => {
  const weekly = Array.from({ length: 26 }, (_, i) => i + 1); // 1..26, newest last

  it('keeps the weeks as they are when no whole week has passed', () => {
    expect(realignWeekly(weekly, '2026-11-18T00:00:00Z', new Date('2026-11-24T00:00:00Z'))).toEqual(weekly);
  });

  it('moves older weeks back and leaves the unknown recent weeks at zero', () => {
    const shifted = realignWeekly(weekly, '2026-11-04T00:00:00Z', NOW); // two weeks later
    expect(shifted).toHaveLength(26);
    expect(shifted.slice(0, 24)).toEqual(weekly.slice(2));
    expect(shifted.slice(24)).toEqual([0, 0]);
  });

  it('empties a window older than 26 weeks', () => {
    expect(realignWeekly(weekly, '2026-01-01T00:00:00Z', NOW)).toEqual(new Array(26).fill(0));
  });
});

describe('refreshFailed', () => {
  it('fails the health check only when a fetch failed', () => {
    expect(refreshFailed('updated', true)).toBe(false);
    expect(refreshFailed('partial', true)).toBe(true);
    expect(refreshFailed('kept-snapshot', true)).toBe(true);
    // No token yet: the site keeps the committed snapshot, with a warning.
    expect(refreshFailed('kept-snapshot', false)).toBe(false);
  });
});

describe('runFetchActivity', () => {
  it('writes only whitelisted keys, whatever the fetch returns', async () => {
    const leaky = (source: ActivitySource) =>
      Promise.resolve({
        slug: source.slug,
        totalCommits: 7,
        lastCommitAt: '2026-11-17T20:00:00Z',
        weekly: new Array<number>(26).fill(1),
        branch: source.branch,
        message: 'feat: secret feature',
      } as RepoActivity);
    const { input, writeSnapshot } = deps({ fetchRepo: leaky });

    expect(await runFetchActivity(input)).toBe('updated');
    expect(writeSnapshot).toHaveBeenCalledTimes(1);
    const written = writeSnapshot.mock.calls[0][0];
    expect(Object.keys(written).sort()).toEqual(['generatedAt', 'repos']);
    expect(written.repos).toHaveLength(activitySources.length);
    for (const entry of written.repos) {
      expect(Object.keys(entry).sort()).toEqual(['lastCommitAt', 'slug', 'totalCommits', 'weekly']);
    }
    expect(JSON.stringify(written)).not.toMatch(/milestone|secret/);
  });

  it('keeps snapshot when token is undefined', async () => {
    const { input, writeSnapshot, warn } = deps({ token: undefined });

    expect(await runFetchActivity(input)).toBe('kept-snapshot');
    expect(writeSnapshot).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ACTIVITY_TOKEN'));
  });

  it('keeps snapshot when every repo fails (403)', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('Forbidden', { status: 403 })));
    const { input, writeSnapshot } = deps({ fetchImpl: asFetch(fetchMock) });

    expect(await runFetchActivity(input)).toBe('kept-snapshot');
    expect(writeSnapshot).not.toHaveBeenCalled();
  });

  it('one failing repo keeps its previous entry; the others update', async () => {
    const fetchRepo = (source: ActivitySource) =>
      source.slug === 'sakurai'
        ? Promise.reject(new GitHubHttpError(500, 'GitHub API 500'))
        : Promise.resolve(repoEntry(source.slug, 999, 9));
    const { input, writeSnapshot, warn } = deps({ fetchRepo });

    expect(await runFetchActivity(input)).toBe('partial');
    const written = writeSnapshot.mock.calls[0][0];
    expect(written.generatedAt).toBe(NOW.toISOString());
    expect(written.repos.map((r) => r.slug)).toEqual(activitySources.map((s) => s.slug));
    expect(written.repos.find((r) => r.slug === 'sakurai')).toEqual(
      previousSnapshot.repos.find((r) => r.slug === 'sakurai')
    );
    for (const slug of ['questday', 'rally-voley', 'yokaido']) {
      expect(written.repos.find((r) => r.slug === slug)?.totalCommits, slug).toBe(999);
    }
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('sakurai'));
  });

  it('a kept entry is realigned to the new end date', async () => {
    const twoWeeksOld: ActivitySnapshot = {
      generatedAt: new Date(NOW.getTime() - 14 * DAY).toISOString(),
      repos: [{ ...repoEntry('sakurai', 200), weekly: Array.from({ length: 26 }, (_, i) => i) }],
    };
    const fetchRepo = (source: ActivitySource) =>
      source.slug === 'sakurai'
        ? Promise.reject(new GitHubHttpError(502, 'GitHub API 502'))
        : Promise.resolve(repoEntry(source.slug, 1));
    const { input, writeSnapshot } = deps({ fetchRepo, readSnapshot: async () => twoWeeksOld });

    expect(await runFetchActivity(input)).toBe('partial');
    const sakurai = writeSnapshot.mock.calls[0][0].repos.find((r) => r.slug === 'sakurai')!;
    expect(sakurai.totalCommits).toBe(200);
    expect(sakurai.weekly.slice(24)).toEqual([0, 0]);
    expect(sakurai.weekly[0]).toBe(2);
  });

  it('a failing repo with no previous entry is left out', async () => {
    const fetchRepo = (source: ActivitySource) =>
      source.slug === 'yokaido'
        ? Promise.reject(new Error('network down'))
        : Promise.resolve(repoEntry(source.slug, 1));
    const { input, writeSnapshot, warn } = deps({
      fetchRepo,
      readSnapshot: async () => ({ generatedAt: NOW.toISOString(), repos: [] }),
    });

    expect(await runFetchActivity(input)).toBe('partial');
    expect(writeSnapshot.mock.calls[0][0].repos.map((r) => r.slug)).not.toContain('yokaido');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('yokaido'));
  });

  it('retries on main when the configured branch is gone (404)', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('sha=feat%2Fmilestone-1')
          ? makeResponse({ message: 'Not Found' }, {}, 404)
          : makeResponse([{ commit: { committer: { date: '2026-11-17T00:00:00Z' } } }])
      )
    );
    const { input, writeSnapshot, warn } = deps({ fetchImpl: asFetch(fetchMock) });

    expect(await runFetchActivity(input)).toBe('updated');
    const rallyUrls = fetchMock.mock.calls
      .map((call) => call[0] as string)
      .filter((url) => url.includes('/rally-voley/'));
    expect(rallyUrls.some((url) => url.includes('sha=main'))).toBe(true);
    expect(writeSnapshot.mock.calls[0][0].repos.map((r) => r.slug)).toContain('rally-voley');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rally-voley'));
  });

  it('never prints a branch name (the workflow logs are public)', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(makeResponse({ message: 'Not Found' }, {}, 404)));
    const { input, warn } = deps({ fetchImpl: asFetch(fetchMock) });

    await runFetchActivity(input);
    expect(warn).toHaveBeenCalled();
    for (const [message] of warn.mock.calls) expect(message).not.toMatch(/milestone/);
  });
});
