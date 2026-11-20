import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from '@/content/site';
import { STACK } from '@/content/stack';
import type { Locale } from '@/i18n/routing';

/** Propiedades del sistema: the stack, as the machine's specifications. */
export async function SystemApp({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'os' });

  return (
    <div className="os-system">
      <h2 className="os-heading">{t('system.heading')}</h2>
      <dl className="os-specs">
        <div>
          <dt>{t('system.os')}</dt>
          <dd>{t('name')}</dd>
        </div>
        <div>
          <dt>{t('system.user')}</dt>
          <dd>{SITE_NAME}</dd>
        </div>
        <div>
          <dt>{t('system.location')}</dt>
          <dd>Barcelona</dd>
        </div>
        <div>
          <dt>{t('system.components')}</dt>
          <dd>
            <ul className="os-chips">
              {STACK.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </div>
  );
}
