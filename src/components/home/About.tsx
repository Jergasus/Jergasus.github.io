import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { Reveal } from '@/components/motion/Reveal';

// Technologies used in the four featured projects (spec §3.2).
// Proper nouns — same in all locales, hardcoded here.
const STACK = [
  'Next.js',
  'React',
  'TypeScript',
  'Tailwind',
  'GSAP',
  'Cloudflare Workers / D1',
  'NestJS',
  'MongoDB',
  'Angular',
  'Godot',
  'Playwright',
  'Vitest',
] as const;

type Props = { locale: Locale };

export async function About({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'about' });

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      data-about
      className="border-t border-rule px-gutter py-2xl lg:py-3xl"
    >
      <Reveal className="mx-auto max-w-page">
        <h2
          id="about-heading"
          data-about-heading
          data-reveal-heading
          className="font-display text-step-4 uppercase"
        >
          {t('heading')}
        </h2>

        <div className="mt-l grid gap-l lg:grid-cols-3">
          {/* Photo — explicit width/height prevents layout shift.
              photo-treatment (globals.css) reads --photo-filter (tokens.css):
              CSS-only sepia pulls the portrait into the warm palette without
              touching the source file. border border-rule gives it definition
              against the paper background at desktop. max-w-photo
              (--photo-max) sizes it below lg; from lg it fills its column. */}
          <div data-about-photo data-reveal-item className="lg:col-span-1">
            <picture className="block border border-rule max-w-photo lg:max-w-none">
              <source srcSet="/about/jesus-garcia.avif" type="image/avif" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/about/jesus-garcia.webp"
                alt={t('photoAlt')}
                width={800}
                height={1000}
                loading="lazy"
                decoding="async"
                className="block w-full photo-treatment"
              />
            </picture>
          </div>

          {/* Bio + stack */}
          <div data-about-bio data-reveal-item className="lg:col-span-2 lg:pl-m">
            <p className="max-w-prose text-pretty text-step-1 text-ink">
              {t('bio')}
            </p>

            <div className="mt-l">
              <p className="font-mono text-step--1 text-ink-muted">
                {t('stackLabel')}
              </p>
              <div className="mt-xs flex flex-wrap gap-2xs">
                {STACK.map((tech) => (
                  <span
                    key={tech}
                    className="border border-rule px-2xs py-3xs font-mono text-step--1 text-ink"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
