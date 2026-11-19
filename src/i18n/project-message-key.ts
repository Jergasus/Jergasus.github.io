import type { ProjectSlug } from '@/content/projects';

// Message keys are camelCase (projects.rallyVoley, caseStudies.rallyVoley);
// slugs are URL-style.
export const projectMessageKey = {
  questday: 'questday',
  sakurai: 'sakurai',
  'rally-voley': 'rallyVoley',
  yokaido: 'yokaido',
} as const satisfies Record<ProjectSlug, string>;
