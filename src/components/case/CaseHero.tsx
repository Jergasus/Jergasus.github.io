import type { Project } from '@/content/projects';
import { StatusMarker } from '@/components/project/StatusMarker';

type Props = {
  project: Project;
  /** Two-digit position in the work index: the same number the row shows. */
  number: string;
  statusLabel: string;
  summary: string;
  imageAlt: string;
  /** Present only when the project has a public URL (spec §3.2). */
  visit: { href: string; label: string; newTab: string } | null;
};

/**
 * Opening of a case page. The meta line repeats the work row (number, status
 * marker), so the page reads as that row opened up; then the name as a poster,
 * the summary, the live link and the project's own screenshot.
 */
export function CaseHero({ project, number, statusLabel, summary, imageAlt, visit }: Props) {
  return (
    <header data-case-hero className="px-gutter pt-l pb-xl md:pt-xl lg:pb-2xl">
      <div className="mx-auto max-w-page">
        <p
          data-load-item
          className="flex items-baseline justify-between gap-s pb-xs font-mono text-step--1"
        >
          {/* The page title already names the project; the number is the
              index position, shown for continuity only. */}
          <span aria-hidden="true" className="text-ink-muted">
            {number}
          </span>
          <span>
            <StatusMarker status={project.status} />
            {statusLabel}
          </span>
        </p>
        {/* The meta line's rule, an element of its own so a direct visit's
            page-load sequence (PageLoad) can draw it in. */}
        <span aria-hidden="true" data-load-rule className="block origin-left border-t border-rule" />

        {/* One masked line (globals.css): the name rises as a block, even
            when it wraps. */}
        <h1 id="case-title" data-case-title className="mt-s font-display text-step-6 uppercase text-balance">
          <span className="reveal-line-mask block">
            <span data-load-line className="reveal-line">
              {project.name}
            </span>
          </span>
        </h1>

        <div className="mt-m grid gap-m lg:grid-cols-12 lg:items-end lg:gap-x-m">
          <p data-load-item className="max-w-prose text-step-2 text-pretty lg:col-span-8">
            {summary}
          </p>

          {visit && (
            <div data-load-item className="lg:col-span-4 lg:justify-self-end">
              {/* Accent fill = actionable, as the business CTA. */}
              <a
                href={visit.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-accent px-m py-s font-mono text-step--1 uppercase tracking-wide text-accent-ink hover:bg-ink hover:text-paper active:bg-ink active:text-paper"
              >
                {visit.label}
                <span className="sr-only">, {visit.newTab}</span>
              </a>
            </div>
          )}
        </div>

        {project.preview && (
          // Same 1600x1000 still as the work preview: explicit size, no
          // layout shift while it loads. It never animates: it is the page's
          // largest paint, and a fade would hold that back.
          <picture data-case-image className="mt-l block border border-rule lg:mt-xl">
            <source type="image/avif" srcSet={project.preview.avif} />
            <img
              src={project.preview.webp}
              alt={imageAlt}
              width={1600}
              height={1000}
              fetchPriority="high"
              decoding="async"
              className="block h-auto w-full"
            />
          </picture>
        )}
      </div>
    </header>
  );
}
