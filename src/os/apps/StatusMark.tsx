import type { ProjectStatus } from '@/content/projects';

/** Decorative square before a project's status label (the label carries the meaning): filled when live. */
export function StatusMark({ status }: { status: ProjectStatus }) {
  return <span className="os-mark" data-status={status} aria-hidden="true" />;
}
