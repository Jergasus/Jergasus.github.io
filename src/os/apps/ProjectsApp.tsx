import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';
import { projects, type Project } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { projectMessageKey } from '@/i18n/project-message-key';
import { getApp, type CaseAppId } from '../apps';
import { APP_ICONS } from '../icons';
import { OpenAppButton, OpenAppLink } from '../OpenApp';
import { StatusMark } from './StatusMark';

type Item = { project: Project; oneLiner: string; statusLabel: string };

function ItemContent({ project, oneLiner, statusLabel }: Item) {
  const Icon = APP_ICONS[project.slug];
  return (
    <>
      <span
        className="os-project-icon"
        aria-hidden="true"
        style={{ '--tile': `var(--os-c-${getApp(project.slug)!.colour})` } as CSSProperties}
      >
        <Icon size={30} />
      </span>
      <span className="os-project-name">{project.name}</span>
      <span className="os-project-summary">{oneLiner}</span>
      <span className="os-project-status">
        <StatusMark status={project.status} />
        {statusLabel}
      </span>
    </>
  );
}

/** proyectos: the four projects. A case study opens its window (and URL); Yokaido opens its card. */
export async function ProjectsApp({ locale }: { locale: Locale }) {
  const [tProjects, tWork] = await Promise.all([
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
        // The visible text is the control's name (WCAG 2.5.3, label in
        // name): the project, its one-liner and its status, in that order.
        return (
          <li key={project.slug}>
            {project.hasCaseStudy ? (
              <OpenAppLink app={project.slug as CaseAppId} className="os-project">
                <ItemContent {...item} />
              </OpenAppLink>
            ) : (
              <>
                {/* No case page: it opens its card. A document (no JavaScript)
                    links to the card further down instead. */}
                <OpenAppButton app="yokaido" className="os-project os-js-only">
                  <ItemContent {...item} />
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
