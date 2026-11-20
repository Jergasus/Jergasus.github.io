import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { projects, type Project } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { projectMessageKey } from '@/i18n/project-message-key';
import { getApp, type CaseAppId } from '../apps';
import { OpenAppButton, OpenAppLink } from '../OpenApp';
import { StatusMark } from './StatusMark';

type Item = { project: Project; oneLiner: string; statusLabel: string };

function ItemContent({ project, oneLiner, statusLabel, ids }: Item & { ids?: { summary: string; status: string } }) {
  return (
    <>
      {/* Placeholder tile until the project icons are drawn. */}
      <span
        className="os-project-icon"
        aria-hidden="true"
        style={{ '--tile': `var(--os-c-${getApp(project.slug)!.colour})` } as CSSProperties}
      >
        {project.name[0]}
      </span>
      <span className="os-project-name">{project.name}</span>
      <span id={ids?.summary} className="os-project-summary">
        {oneLiner}
      </span>
      <span id={ids?.status} className="os-project-status">
        <StatusMark status={project.status} />
        {statusLabel}
      </span>
    </>
  );
}

/** proyectos: the four projects. A case study opens its window (and URL); Yokaido opens its card. */
export async function ProjectsApp({ locale }: { locale: Locale }) {
  const [t, tProjects, tWork] = await Promise.all([
    getTranslations({ locale, namespace: 'os' }),
    getTranslations({ locale, namespace: 'projects' }),
    getTranslations({ locale, namespace: 'work' }),
  ]);

  return (
    <ul className="os-projects">
      {projects.map((project) => {
        const item: Item = {
          project,
          oneLiner: tProjects(`${projectMessageKey[project.slug]}.oneLiner`),
          statusLabel: tWork(`status.${project.status}`),
        };
        const ids = { summary: `projects-${project.slug}-summary`, status: `projects-${project.slug}-status` };
        const control = {
          className: 'os-project',
          'aria-label': t('projects.open', { name: project.name }),
          'aria-describedby': `${ids.summary} ${ids.status}`,
        };
        return (
          <li key={project.slug}>
            {project.hasCaseStudy ? (
              <OpenAppLink app={project.slug as CaseAppId} {...control}>
                <ItemContent {...item} ids={ids} />
              </OpenAppLink>
            ) : (
              <>
                {/* No case page: it opens its card. A document (no JavaScript)
                    links to the card further down instead. */}
                <OpenAppButton app="yokaido" {...control} className="os-project os-js-only">
                  <ItemContent {...item} ids={ids} />
                </OpenAppButton>
                <a href="#yokaido" className="os-project os-nojs-only">
                  <ItemContent {...item} />
                </a>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
