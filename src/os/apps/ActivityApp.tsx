import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { getProject } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { aggregate, parseActivitySnapshot, resolveCurrentlyBuilding } from '@/lib/activity';
import { formatDate } from '@/lib/dates';
import { status } from '@/lib/status';
import snapshot from '../../../data/activity.json';

// The committed snapshot goes through the same privacy whitelist the fetch
// script writes with; an invalid file throws here and fails the build.
const committed = parseActivitySnapshot(snapshot);
const activity = aggregate(committed);

/** Commit count to an intensity level 0-4, relative to the busiest week. */
function intensity(n: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (n === 0 || max === 0) return 0;
  const ratio = n / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/** actividad: the task manager. Per-project commits, then the 26-week grid. */
export async function ActivityApp({ locale }: { locale: Locale }) {
  const [t, tNow] = await Promise.all([
    getTranslations({ locale, namespace: 'os' }),
    getTranslations({ locale, namespace: 'now' }),
  ]);
  const number = new Intl.NumberFormat(locale);
  const busiest = Math.max(...committed.repos.map((repo) => repo.totalCommits), 1);
  const weeklyMax = Math.max(...activity.weekly, 0);
  const weeklyTotal = activity.weekly.reduce((sum, n) => sum + n, 0);

  return (
    <div className="os-activity">
      <p className="os-activity-building">
        <span className="os-label">{tNow('buildingLabel')}</span>
        <span>{resolveCurrentlyBuilding(status, activity, locale)}</span>
      </p>

      <table className="os-table">
        <thead>
          <tr>
            <th scope="col">{t('activity.project')}</th>
            <th scope="col">{t('activity.total')}</th>
            <th scope="col">{t('activity.recent')}</th>
            <th scope="col">{t('activity.last')}</th>
          </tr>
        </thead>
        <tbody>
          {committed.repos.map((repo) => (
            <tr key={repo.slug}>
              <th scope="row">
                {getProject(repo.slug)!.name}
                {/* Each project's share of the busiest one: the numbers say it. */}
                <span
                  className="os-bar"
                  aria-hidden="true"
                  style={{ '--share': `${((repo.totalCommits / busiest) * 100).toFixed(1)}%` } as CSSProperties}
                />
              </th>
              <td>{number.format(repo.totalCommits)}</td>
              <td>{number.format(repo.weekly.reduce((sum, n) => sum + n, 0))}</td>
              <td>
                <time dateTime={repo.lastCommitAt}>{formatDate(repo.lastCommitAt, locale, 'short')}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The caption says what the cells are, to every reader; the cells only
          draw it. It names the date the weeks end on, so it stays true
          however old the snapshot is. */}
      <div data-now-grid className="os-grid">
        <p data-now-caption className="os-label">
          {tNow('gridLabel', {
            count: weeklyTotal,
            weeks: 26,
            date: formatDate(committed.generatedAt, locale, 'long'),
          })}
        </p>
        <div aria-hidden="true" className="os-grid-cells">
          {activity.weekly.map((n, i) => (
            <span key={i} data-intensity={intensity(n, weeklyMax)} />
          ))}
        </div>
      </div>
    </div>
  );
}
