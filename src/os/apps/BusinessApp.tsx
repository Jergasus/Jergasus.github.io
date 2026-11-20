import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { OpenAppButton } from '../OpenApp';

/**
 * nuevo_proyecto: the three steps for a local business, as static copy. The
 * wizard (a later task) mounts in [data-wizard-slot]; until then, and in a
 * document, the call to action leads to contact.
 */
export async function BusinessApp({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'business' });
  const steps = [
    { label: t('step1Label'), desc: t('step1Desc') },
    { label: t('step2Label'), desc: t('step2Desc') },
    { label: t('step3Label'), desc: t('step3Desc') },
  ];

  return (
    <div className="os-business">
      <h2 className="os-heading">{t('heading')}</h2>
      <p>{t('intro')}</p>
      {/* A real sequence, so an ordered list. */}
      <ol className="os-steps">
        {steps.map(({ label, desc }) => (
          <li key={label}>
            <span className="os-step-label">{label}</span>
            <span>{desc}</span>
          </li>
        ))}
      </ol>
      <div data-wizard-slot />
      <p>
        <OpenAppButton app="contact" className="os-button os-js-only">
          {t('ctaLabel')}
        </OpenAppButton>
        <a href="#contact" className="os-button os-nojs-only">
          {t('ctaLabel')}
        </a>
      </p>
    </div>
  );
}
