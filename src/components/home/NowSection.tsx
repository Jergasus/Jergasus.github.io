import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { status } from '@/lib/status';
import { resolveCurrentlyBuilding, type aggregate } from '@/lib/activity';
import { Reveal } from '@/components/motion/Reveal';
import { ActivityGrid } from './ActivityGrid';

type Props = {
  locale: Locale;
  /** The full aggregate result from HomePage so resolveCurrentlyBuilding
   *  receives the real object instead of a stub. */
  activity: ReturnType<typeof aggregate>;
  /** When the activity snapshot was taken (the grid's end date). */
  generatedAt: string;
};

export async function NowSection({ locale, activity, generatedAt }: Props) {
  const t = await getTranslations({ locale, namespace: 'now' });
  const buildingText = resolveCurrentlyBuilding(status, activity, locale);

  return (
    <section
      id="now"
      aria-labelledby="now-heading"
      data-now
      className="px-gutter py-2xl lg:py-3xl border-t border-rule"
    >
      <Reveal className="mx-auto max-w-page">
        <h2
          id="now-heading"
          data-now-heading
          data-reveal-heading
          className="font-display text-step-4 uppercase"
        >
          {t('heading')}
        </h2>

        {/* Currently building */}
        <div
          data-now-building
          data-reveal-item
          className="mt-m grid gap-2xs border-t-hair border-rule pt-m lg:grid-cols-3"
        >
          <p className="font-mono text-step--1 text-ink-muted">
            {t('buildingLabel')}
          </p>
          <p className="font-display text-step-2 text-ink lg:col-span-2">
            {buildingText}
          </p>
        </div>

        {/* Weekly activity grid */}
        <ActivityGrid weekly={activity.weekly} generatedAt={generatedAt} locale={locale} />
      </Reveal>
    </section>
  );
}
