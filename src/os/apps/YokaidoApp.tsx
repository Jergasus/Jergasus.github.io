import { getTranslations } from 'next-intl/server';
import { getProject } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { StatusMark } from './StatusMark';

/**
 * Yokaido has no case study (spec §6.2): a small status card with what is
 * already known, and nothing more.
 */
export async function YokaidoApp({ locale }: { locale: Locale }) {
  const project = getProject('yokaido')!;
  const [t, tProjects, tWork] = await Promise.all([
    getTranslations({ locale, namespace: 'os' }),
    getTranslations({ locale, namespace: 'projects' }),
    getTranslations({ locale, namespace: 'work' }),
  ]);

  return (
    <div className="os-card">
      <h2 className="os-heading">{project.name}</h2>
      <p>{tProjects('yokaido.oneLiner')}</p>
      <p className="os-case-status">
        <StatusMark status={project.status} />
        {tWork(`status.${project.status}`)}
      </p>
      <dl className="os-specs">
        <div>
          <dt>{t('yokaido.engine')}</dt>
          <dd>{project.stack[0]}</dd>
        </div>
      </dl>
    </div>
  );
}
