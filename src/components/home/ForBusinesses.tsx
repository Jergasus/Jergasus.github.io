import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { Reveal } from '@/components/motion/Reveal';

type Props = { locale: Locale };

const STEP_NUMBERS = ['01', '02', '03'] as const;

export async function ForBusinesses({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'business' });

  const steps = [
    { label: t('step1Label'), desc: t('step1Desc') },
    { label: t('step2Label'), desc: t('step2Desc') },
    { label: t('step3Label'), desc: t('step3Desc') },
  ];

  return (
    <section
      id="business"
      aria-labelledby="business-heading"
      data-business
      className="border-t border-rule px-gutter py-2xl lg:py-3xl"
    >
      <Reveal className="mx-auto max-w-page">
        <h2
          id="business-heading"
          data-business-heading
          data-reveal-heading
          className="font-display text-step-4 uppercase"
        >
          {t('heading')}
        </h2>

        <p data-reveal-item className="mt-m max-w-prose text-pretty text-step-1 text-ink">
          {t('intro')}
        </p>

        {/* Three-step process — genuine sequence, so <ol> is correct. The
            steps settle one after another, like the index rows. */}
        <ol className="mt-l border-y border-rule">
          {steps.map(({ label, desc }, i) => (
            <li
              key={i}
              data-business-step
              data-reveal-item
              className="grid gap-xs border-t-hair border-rule py-m first:border-t-0 lg:grid-cols-3 lg:gap-0"
            >
              <div className="flex items-baseline gap-s lg:col-span-1">
                <span
                  aria-hidden="true"
                  className="font-mono text-step--1 text-ink-muted tabular-nums"
                >
                  {STEP_NUMBERS[i]}
                </span>
                <span className="font-display text-step-2 uppercase">{label}</span>
              </div>
              <p className="text-step-0 text-ink lg:col-span-2 lg:pl-m">{desc}</p>
            </li>
          ))}
        </ol>

        {/* CTA anchors to the contact section below. Accent fill = actionable. */}
        <div data-reveal-item className="mt-l">
          <a
            href="#contact"
            data-business-cta
            className="inline-block bg-accent px-m py-s font-mono text-step--1 uppercase tracking-wide text-accent-ink hover:bg-ink hover:text-paper active:bg-ink active:text-paper"
          >
            {t('ctaLabel')}
          </a>
        </div>
      </Reveal>
    </section>
  );
}
