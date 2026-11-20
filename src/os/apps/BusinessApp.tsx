import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { OpenAppButton } from '../OpenApp';
import { Wizard } from '../business/Wizard';

/**
 * nuevo_proyecto: the three steps for a local business, as static copy in
 * document / no-JS mode. The interactive Wizard mounts in [data-wizard-slot]
 * in JS mode and replaces the static steps.
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
      {/* Static steps — visible only in document / no-JS mode. */}
      <ol className="os-steps os-nojs-only">
        {steps.map(({ label, desc }) => (
          <li key={label}>
            <span className="os-step-label">{label}</span>
            <span>{desc}</span>
          </li>
        ))}
      </ol>
      {/* Interactive wizard — visible only in JS mode. */}
      <div data-wizard-slot className="os-js-only">
        <Wizard />
      </div>
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
