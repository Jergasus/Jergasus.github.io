import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from '@/content/site';
import type { Locale } from '@/i18n/routing';
import { availabilityLabel, status } from '@/lib/status';

/**
 * Portrait, name and availability — shared between AboutApp and WelcomeApp.
 * Renders as a React fragment: no wrapping element (the parent provides the
 * grid context).
 */
export async function Identity({ locale, className }: { locale: Locale; className?: string }) {
  const [t, tHero] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'hero' }),
  ]);
  const availability = availabilityLabel(status, locale, {
    available: tHero('availability.available'),
    unavailable: tHero('availability.unavailable'),
  });

  return (
    <>
      {/* Explicit size: no layout shift while it loads. */}
      <picture className={['os-portrait', className].filter(Boolean).join(' ')}>
        <source srcSet="/about/jesus-garcia.avif" type="image/avif" />
        <img src="/about/jesus-garcia.webp" alt={t('photoAlt')} width={800} height={1000} decoding="async" />
      </picture>
      <div className={['os-about-head', className].filter(Boolean).join(' ')}>
        <h2 className="os-heading">{SITE_NAME}</h2>
        <p className="os-availability" data-available={String(status.available)}>
          <span className="os-light" aria-hidden="true" />
          {availability}
        </p>
      </div>
    </>
  );
}
