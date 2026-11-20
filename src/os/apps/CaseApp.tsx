import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { getProject, type ProjectSlug } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { projectMessageKey } from '@/i18n/project-message-key';
import { CaseTitle } from '../CaseTitle';
import { OpenBrowserButton } from '../OpenBrowserButton';
import { StatusMark } from './StatusMark';

type Decision = { title: string; body: string };

/** The domain a visitor will land on, without the www. */
const siteName = (url: string) => new URL(url).hostname.replace(/^www\./, '');

/** A project window: the case study, written to read as a clean, professional page. */
export async function CaseApp({ locale, slug }: { locale: Locale; slug: ProjectSlug }) {
  const project = getProject(slug);
  if (!project?.hasCaseStudy) throw new Error(`No case study for "${slug}"`);
  const [t, tStudy, tWork, tBrowser] = await Promise.all([
    getTranslations({ locale, namespace: 'casePage' }),
    getTranslations({ locale, namespace: `caseStudies.${projectMessageKey[slug]}` }),
    getTranslations({ locale, namespace: 'work' }),
    getTranslations({ locale, namespace: 'os.browser' }),
  ]);
  const decisions = tStudy.raw('decisions') as Decision[];
  // Two project windows can be open at once: every id carries the slug.
  const id = (part: string) => `${slug}-${part}`;

  return (
    <div className="os-case">
      <div className="os-case-head">
        <CaseTitle className="os-case-title">{project.name}</CaseTitle>
        <p className="os-case-status">
          <StatusMark status={project.status} />
          {tWork(`status.${project.status}`)}
        </p>
        <p className="os-case-summary">{tStudy('summary')}</p>
        {project.preview && (
          // 1600 x 1000 still with an explicit size: no shift while it loads.
          <picture className="os-shot">
            <source type="image/avif" srcSet={project.preview.avif} />
            <img
              src={project.preview.webp}
              alt={t('imageAlt', { project: project.name })}
              width={1600}
              height={1000}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        )}
        {project.liveUrl && (
          <p className="os-case-actions">
            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer" className="os-button">
              {t('visit', { site: siteName(project.liveUrl) })}
              <span className="sr-only">, {t('newTab')}</span>
            </a>
            {/* Opens the retro browser window and loads the live site inside it. */}
            <OpenBrowserButton url={project.liveUrl} label={tBrowser('openButton')} />
          </p>
        )}
      </div>

      <CaseSection id={id('problem')} heading={t('problem')}>
        <p>{tStudy('problem')}</p>
      </CaseSection>

      <CaseSection id={id('built')} heading={t('built')}>
        <p>{tStudy('built')}</p>
      </CaseSection>

      <CaseSection id={id('decisions')} heading={t('decisions')}>
        {/* Not a sequence: an unordered list, scannable by its h3s. */}
        <ul className="os-decisions">
          {decisions.map((decision) => (
            <li key={decision.title}>
              <h3>{decision.title}</h3>
              <p>{decision.body}</p>
            </li>
          ))}
        </ul>
      </CaseSection>

      <CaseSection id={id('stack')} heading={t('stack')}>
        <p>{tStudy('stackNote')}</p>
        <ul aria-labelledby={id('stack')} className="os-chips">
          {project.stack.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>
      </CaseSection>
    </div>
  );
}

function CaseSection({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section className="os-case-section">
      <h2 id={id}>{heading}</h2>
      {children}
    </section>
  );
}
