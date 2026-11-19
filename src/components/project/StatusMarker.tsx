import type { ProjectStatus } from '@/content/projects';

// The marker repeats the hero's availability square: filled accent means live,
// an outline means not out yet.
const MARKER = {
  live: 'bg-accent',
  building: 'border-hair border-current',
  wip: 'border-hair border-current',
} as const satisfies Record<ProjectStatus, string>;

/** Decorative square before a project's status label (the label carries the meaning). */
export function StatusMarker({ status }: { status: ProjectStatus }) {
  return (
    <span
      aria-hidden="true"
      className={`mr-2xs inline-block size-2xs align-middle ${MARKER[status]}`}
    />
  );
}
