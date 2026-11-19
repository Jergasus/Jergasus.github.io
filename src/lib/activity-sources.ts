import type { ProjectSlug } from '@/content/projects';

/**
 * Where each featured project's activity numbers come from (spec §4).
 *
 * BUILD-ONLY. Only src/lib/github-activity.ts (run by
 * scripts/fetch-activity.ts) imports this. Pages and components never do, so
 * private repo names and branch names can never reach a browser bundle
 * (activity-sources.test.ts guards the imports; e2e/privacy.spec.ts scans
 * the build output).
 */
export interface ActivitySource {
  slug: ProjectSlug;
  owner: string;
  name: string;
  branch: string;
}

export const activitySources: readonly ActivitySource[] = [
  { slug: 'questday', owner: 'Jergasus', name: 'questday', branch: 'main' },
  { slug: 'sakurai', owner: 'Jergasus', name: 'SakurAI', branch: 'main' },
  // Rally Voley's work happens on this branch until it merges. Once the branch
  // is gone, the fetch falls back to main and warns (github-activity.ts).
  { slug: 'rally-voley', owner: 'Jergasus', name: 'rally-voley', branch: 'feat/milestone-1' },
  { slug: 'yokaido', owner: 'Jergasus', name: 'Yokaido', branch: 'main' },
];
