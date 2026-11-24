import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { Identity } from './Identity';

/** sobre_mi.txt: who he is, in five seconds. */
export async function AboutApp({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'about' });

  return (
    <div className="os-about">
      <Identity locale={locale} className="os-js-only" />
      <p className="os-about-bio">{t('bio')}</p>
    </div>
  );
}
