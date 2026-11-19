import type { ReactNode } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { localizedPath } from '@/i18n/localized-path';
import { projectMessageKey } from '@/i18n/project-message-key';
import { caseStudySlugs, getProject, projects, type Project, type ProjectSlug } from '@/content/projects';
import { CASE_OPEN } from '@/design/motion';
import { CaseHero } from '@/components/case/CaseHero';
import { PageLoad } from '@/components/motion/PageLoad';
import { PageTransition } from '@/components/motion/PageTransition';
import { Reveal } from '@/components/motion/Reveal';

type Decision = { title: string; body: string };
type Props = { locale: Locale; slug: ProjectSlug };

function caseProject(slug: ProjectSlug): Project {
  const project = getProject(slug);
  if (!project?.hasCaseStudy) throw new Error(`No case study for "${slug}"`);
  return project;
}

/** Neighbours in index order, wrapping around, so every page has both. */
function neighbours(slug: ProjectSlug) {
  const at = caseStudySlugs.indexOf(slug);
  const count = caseStudySlugs.length;
  return {
    previous: caseProject(caseStudySlugs[(at - 1 + count) % count]),
    next: caseProject(caseStudySlugs[(at + 1) % count]),
  };
}

/** The domain a visitor will land on, without the www. */
const siteName = (url: string) => new URL(url).hostname.replace(/^www\./, '');

export async function CaseStudyPage({ locale, slug }: Props) {
  // next-intl's <Link> reads the request locale (see HomePage).
  setRequestLocale(locale);

  const project = caseProject(slug);
  const [t, tStudy, tWork] = await Promise.all([
    getTranslations({ locale, namespace: 'casePage' }),
    getTranslations({ locale, namespace: `caseStudies.${projectMessageKey[slug]}` }),
    getTranslations({ locale, namespace: 'work' }),
  ]);
  const decisions = tStudy.raw('decisions') as Decision[];
  const { previous, next } = neighbours(slug);

  return (
    <PageTransition>
      <article aria-labelledby="case-title">
        {/* Plays on a direct visit only; a row click brings the page in with
            the view transition instead. */}
        <PageLoad name="case">
          <CaseHero
            project={project}
            number={String(projects.indexOf(project) + 1).padStart(2, '0')}
            statusLabel={tWork(`status.${project.status}`)}
            summary={tStudy('summary')}
            imageAlt={t('imageAlt', { project: project.name })}
            visit={
              project.liveUrl
                ? {
                    href: project.liveUrl,
                    label: t('visit', { site: siteName(project.liveUrl) }),
                    newTab: t('newTab'),
                  }
                : null
            }
          />
        </PageLoad>

        <CaseSection id="case-problem" heading={t('problem')}>
          <p className="max-w-prose text-step-1 leading-text text-pretty">{tStudy('problem')}</p>
        </CaseSection>

        <CaseSection id="case-built" heading={t('built')}>
          <p className="max-w-prose text-step-1 leading-text text-pretty">{tStudy('built')}</p>
        </CaseSection>

        <CaseSection id="case-decisions" heading={t('decisions')}>
          {/* Not a sequence, so an unordered list; each decision is titled
              so the list can be scanned by its h3s. */}
          <ul className="max-w-prose">
            {decisions.map((decision) => (
              <li
                key={decision.title}
                data-case-decision
                className="border-t-hair border-rule py-s first:border-t-0 first:pt-0 last:pb-0"
              >
                <h3 className="text-step-1 font-strong text-balance">{decision.title}</h3>
                <p className="mt-2xs text-pretty">{decision.body}</p>
              </li>
            ))}
          </ul>
        </CaseSection>

        <CaseSection id="case-stack" heading={t('stack')}>
          <p className="max-w-prose text-pretty">{tStudy('stackNote')}</p>
          <ul aria-labelledby="case-stack" className="mt-m flex flex-wrap gap-2xs">
            {project.stack.map((tech) => (
              <li
                key={tech}
                className="border border-rule px-2xs py-3xs font-mono text-step--1 text-ink"
              >
                {tech}
              </li>
            ))}
          </ul>
        </CaseSection>
      </article>

      <nav aria-label={t('moreWork')} data-case-nav className="border-t border-rule px-gutter">
        <div className="mx-auto grid max-w-page sm:grid-cols-2">
          <NeighbourLink
            label={t('previous')}
            project={previous}
            className="py-m sm:border-r sm:border-rule sm:pr-m"
          />
          <NeighbourLink
            label={t('next')}
            project={next}
            className="border-t-hair border-rule py-m sm:border-t-0 sm:pl-m sm:text-right"
          />
        </div>
        {/* The page's last block: its bottom padding is the space before the
            footer, as a home section's is. */}
        <div className="mx-auto max-w-page border-t-hair border-rule pt-s pb-2xl lg:pb-3xl">
          {/* Root + hash, like the header links: a full load that lands on
              the work index. */}
          <a
            href={`${localizedPath('/', locale)}#work`}
            className="font-mono text-step--1 text-ink-muted hover:text-ink active:text-ink"
          >
            {t('allWork')}
          </a>
        </div>
      </nav>
    </PageTransition>
  );
}

// Section rhythm: rule, label column, content column. Below lg the label sits
// above the content. Each section reveals on scroll: the label rises, then
// the content settles as one block.
function CaseSection({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      data-case-section
      className="border-t border-rule px-gutter py-l lg:py-xl"
    >
      <Reveal className="mx-auto grid max-w-page gap-s lg:grid-cols-12 lg:gap-x-m">
        <h2 id={id} data-reveal-heading className="font-display text-step-3 uppercase lg:col-span-4">
          {heading}
        </h2>
        <div data-reveal-item className="lg:col-span-8">
          {children}
        </div>
      </Reveal>
    </section>
  );
}

function NeighbourLink({
  label,
  project,
  className,
}: {
  label: string;
  project: Project;
  className: string;
}) {
  return (
    <Link
      href={`/work/${project.slug}/`}
      transitionTypes={[CASE_OPEN]}
      className={`group block ${className}`}
    >
      <span className="block font-mono text-step--1 text-ink-muted">{label}</span>{' '}
      {/* Hard colour cut on hover, press and keyboard focus, as the work rows. */}
      <span className="block font-display text-step-4 uppercase group-hover:text-accent group-active:text-accent group-focus-visible:text-accent">
        {project.name}
      </span>
    </Link>
  );
}
