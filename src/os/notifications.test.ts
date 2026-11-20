import { describe, expect, it } from 'vitest';
import { commitNotifications } from './notifications';

// now = 2026-11-20T00:00:00Z
// questday: 2026-11-15T10:00:00Z  → ~4.6 days ago  → within 14 days ✓
// sakurai:  2026-11-10T10:00:00Z  → ~9.6 days ago  → within 14 days ✓
// rally-voley: 2026-11-01T10:00:00Z → ~18.6 days ago → outside 14 days ✗
const now = new Date('2026-11-20T00:00:00Z');
const repos = [
  { slug: 'rally-voley' as const, lastCommitAt: '2026-11-01T10:00:00Z' },
  { slug: 'sakurai' as const, lastCommitAt: '2026-11-10T10:00:00Z' },
  { slug: 'questday' as const, lastCommitAt: '2026-11-15T10:00:00Z' },
];

describe('commitNotifications', () => {
  it('newest first, at most max, only within maxAgeDays', () => {
    const result = commitNotifications(repos, now, { max: 2, maxAgeDays: 14 });
    // rally-voley is out (18.6 days). questday and sakurai are in; newest first.
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('questday');
    expect(result[1].slug).toBe('sakurai');
  });

  it('filters out repos older than maxAgeDays', () => {
    const result = commitNotifications(repos, now, { max: 10, maxAgeDays: 7 });
    // Only questday (4.6 days) qualifies.
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('questday');
  });

  it('respects the max cap even when more qualify', () => {
    const result = commitNotifications(repos, now, { max: 1, maxAgeDays: 14 });
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('questday'); // newest
  });

  it('returns only slug and lastCommitAt', () => {
    const result = commitNotifications(repos, now, { max: 10, maxAgeDays: 14 });
    expect(result.length).toBeGreaterThan(0);
    expect(Object.keys(result[0]).sort()).toEqual(['lastCommitAt', 'slug']);
  });

  it('returns empty array when nothing is within maxAgeDays', () => {
    const result = commitNotifications(repos, now, { max: 10, maxAgeDays: 1 });
    expect(result).toHaveLength(0);
  });
});
