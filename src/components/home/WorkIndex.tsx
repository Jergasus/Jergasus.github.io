import { getTranslations } from 'next-intl/server';
import { projects } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { projectMessageKey } from '@/i18n/project-message-key';
import { HoverPreview, type PreviewImage } from './HoverPreview';
import { WorkRow } from './WorkRow';

const previews: PreviewImage[] = projects.flatMap((project) =>
  project.preview ? [{ slug: project.slug, ...project.preview }] : [],
);

type Props = { locale: Locale };

export async function WorkIndex({ locale }: Props) {
  const [t, tProjects] = await Promise.all([
    getTranslations({ locale, namespace: 'work' }),
    getTranslations({ locale, namespace: 'projects' }),
  ]);

  return (
    <section id="work" aria-labelledby="work-heading" className="px-gutter py-2xl lg:py-3xl">
      <div className="mx-auto max-w-page">
        <h2 id="work-heading" className="font-display text-step-4 uppercase">
          {t('heading')}
        </h2>

        <HoverPreview previews={previews} className="mt-m">
          <ol className="border-y border-rule">
            {projects.map((project, i) => (
              <WorkRow
                key={project.slug}
                project={project}
                number={String(i + 1).padStart(2, '0')}
                oneLiner={tProjects(`${projectMessageKey[project.slug]}.oneLiner`)}
                statusLabel={t(`status.${project.status}`)}
              />
            ))}
          </ol>
        </HoverPreview>
      </div>
    </section>
  );
}
