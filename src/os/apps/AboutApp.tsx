import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from '@/content/site';
import type { Locale } from '@/i18n/routing';
import { availabilityLabel, status } from '@/lib/status';

/** sobre_mi.txt: who he is, in five seconds. */
export async function AboutApp({ locale }: { locale: Locale }) {
  const [t, tHero] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'hero' }),
  ]);
  const availability = availabilityLabel(status, locale, {
    available: tHero('availability.available'),
    unavailable: tHero('availability.unavailable'),
  });

  return (
    <div className="os-about">
      {/* Explicit size: no layout shift while it loads. */}
      <picture className="os-portrait">
        <source srcSet="/about/jesus-garcia.avif" type="image/avif" />
        <img src="/about/jesus-garcia.webp" alt={t('photoAlt')} width={800} height={1000} decoding="async" />
      </picture>
      <div className="os-about-head">
        <h2 className="os-heading">{SITE_NAME}</h2>
        <p className="os-availability" data-available={String(status.available)}>
          <span className="os-light" aria-hidden="true" />
          {availability}
        </p>
      </div>
      <p className="os-about-bio">{t('bio')}</p>
    </div>
  );
}
