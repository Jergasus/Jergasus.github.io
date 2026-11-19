import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { formatDate } from '@/lib/dates';

type Props = {
  weekly: number[];
  /** When the snapshot was taken: the end of the 26 weeks. */
  generatedAt: string;
  locale: Locale;
};

// Full class names are listed here as literals so Tailwind's scanner picks
// them up. bg-activity-* maps to --color-activity-* via globals.css.
const BG_CLASS = [
  'bg-activity-0',
  'bg-activity-1',
  'bg-activity-2',
  'bg-activity-3',
  'bg-activity-4',
] as const;

/** Map a commit count to an intensity level 0–4, bucketed relative to the
 *  maximum week in the array. Level 0 = no commits. */
function intensity(n: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (n === 0 || max === 0) return 0;
  const ratio = n / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export async function ActivityGrid({ weekly, generatedAt, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'now' });
  const count = weekly.reduce((s, n) => s + n, 0);
  const max = Math.max(...weekly, 0);

  return (
    // Settles as one block with the Now section's reveal: the cells are data
    // to read, so they never animate one by one. Same rhythm as the
    // "currently building" row above it: label, then content (from lg, the
    // label's third and the content's two thirds).
    <div
      data-now-grid
      data-reveal-item
      className="mt-m grid gap-2xs border-t-hair border-rule pt-m lg:grid-cols-3"
    >
      {/* The caption says what the cells are, to every reader; the cells
          themselves only draw it, so they stay out of the accessibility tree.
          It names the date the weeks end on (ruling R17), so it stays true
          however old the snapshot is by the time someone reads it. */}
      <p data-now-caption className="font-mono text-step--1 text-ink-muted">
        {t('gridLabel', { count, weeks: 26, date: formatDate(generatedAt, locale, 'long') })}
      </p>
      <div aria-hidden="true" className="grid gap-px grid-cols-[repeat(26,1fr)] lg:col-span-2">
        {weekly.map((n, i) => {
          const level = intensity(n, max);
          return (
            <div
              key={i}
              data-intensity={level}
              className={`aspect-square ${BG_CLASS[level]}`}
            />
          );
        })}
      </div>
    </div>
  );
}
