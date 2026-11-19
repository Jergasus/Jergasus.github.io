import { Link } from '@/i18n/navigation';
import type { Project } from '@/content/projects';
import { CASE_OPEN } from '@/design/motion';
import { StatusMarker } from '@/components/project/StatusMarker';

type Props = {
  project: Project;
  /** Two-digit position in the index: 01, 02 ... */
  number: string;
  oneLiner: string;
  statusLabel: string;
};

// Mobile: number and status share the top line, then the name, then the
// details. From lg the row reads across a 12-column grid, meta (number over
// status) | name | one-liner over stack, and each column's last line sits on
// the name's baseline.
const ROW =
  'grid gap-y-xs py-s lg:grid-cols-12 lg:items-baseline-last lg:gap-x-m lg:py-m';

export function WorkRow({ project, number, oneLiner, statusLabel }: Props) {
  const id = `work-${project.slug}`;
  const interactive = project.hasCaseStudy;
  // Hover only fires on hover-capable pointers (Tailwind v4 gates `hover:`);
  // touch gets the same cue while pressed. Colour changes are hard cuts.
  const nameCue = interactive
    ? 'group-hover:text-accent group-active:text-accent group-focus-visible:text-accent'
    : '';

  const content = (
    <>
      <div className="flex items-baseline justify-between gap-s font-mono text-step--1 lg:col-span-3 lg:flex-col lg:items-start lg:justify-start lg:gap-3xs xl:col-span-2">
        {/* The <ol> already announces the position. */}
        <span aria-hidden="true" className="text-ink-muted">
          {number}
        </span>
        <span id={`${id}-status`}>
          <StatusMarker status={project.status} />
          {statusLabel}
        </span>
      </div>

      <h3
        id={`${id}-name`}
        className={`font-display text-step-5 uppercase lg:col-span-5 ${nameCue}`}
      >
        {project.name}
      </h3>

      <div className="lg:col-span-4 xl:col-span-5">
        <p id={`${id}-summary`} className="max-w-prose text-pretty">
          {oneLiner}
        </p>
        <p className="mt-2xs font-mono text-step--1 text-ink-muted">
          {project.stack.slice(0, 2).join(', ')}
        </p>
      </div>
    </>
  );

  return (
    // data-load-row: the last beat of the page-load sequence (PageLoad); the
    // row settles with its hairline, as one ruled line of the index.
    <li data-load-row className="border-t-hair border-rule first:border-t-0">
      {interactive ? (
        <Link
          href={`/work/${project.slug}/`}
          // Opens the case page with the case-open view transition (globals.css).
          transitionTypes={[CASE_OPEN]}
          data-testid="work-row"
          data-preview-slug={project.preview ? project.slug : undefined}
          aria-labelledby={`${id}-name`}
          aria-describedby={`${id}-summary ${id}-status`}
          className={`group ${ROW}`}
        >
          {content}
        </Link>
      ) : (
        // Ruling R12: no case page, so not a link and no preview. Dimmed as a
        // whole. It is plain content, not a disabled control: aria-disabled
        // on a generic element is unsupported in ARIA 1.2 and would read as
        // a broken control. Its status label ("In progress") says why it
        // has no page, to every reader.
        <div data-testid="work-row" className={`${ROW} text-ink-muted`}>
          {content}
        </div>
      )}
    </li>
  );
}
