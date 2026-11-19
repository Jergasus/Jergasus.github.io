import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { aggregate, parseActivitySnapshot } from '@/lib/activity';
import { Hero } from '@/components/home/Hero';
import { WorkIndex } from '@/components/home/WorkIndex';
import { NowSection } from '@/components/home/NowSection';
import { ForBusinesses } from '@/components/home/ForBusinesses';
import { About } from '@/components/home/About';
import { Contact } from '@/components/home/Contact';
import { PageLoad } from '@/components/motion/PageLoad';
import { PageTransition } from '@/components/motion/PageTransition';
import snapshot from '../../../data/activity.json';

type Props = { locale: Locale };

// The committed snapshot goes through the same privacy whitelist the fetch
// script writes with; an invalid file throws here and fails the build.
const committed = parseActivitySnapshot(snapshot);
const activity = aggregate(committed);

export async function HomePage({ locale }: Props) {
  // next-intl's <Link> reads the request locale. Layouts and pages can render
  // separately, so the page sets it too (next-intl static rendering guide).
  setRequestLocale(locale);

  return (
    // Steps back when a work row opens a case page.
    <PageTransition>
      {/* The page-load sequence: the strip's rules, the name, the lede and
          data, then the index rows. Later sections reveal on scroll. */}
      <PageLoad name="home">
        <Hero
          locale={locale}
          lastCommitAt={activity.lastCommitAt}
          totalCommits={activity.totalCommits}
        />

        <WorkIndex locale={locale} />
      </PageLoad>

      <NowSection locale={locale} activity={activity} generatedAt={committed.generatedAt} />

      <ForBusinesses locale={locale} />

      <About locale={locale} />

      <Contact locale={locale} />
    </PageTransition>
  );
}
