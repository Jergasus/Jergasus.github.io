export type ProjectSlug = 'questday' | 'sakurai' | 'rally-voley' | 'yokaido';
export type ProjectStatus = 'live' | 'building' | 'wip';

export interface Project {
  slug: ProjectSlug;
  name: string;
  status: ProjectStatus;
  liveUrl: string | null;
  stack: string[];
  hasCaseStudy: boolean;
  preview: { avif: string; webp: string } | null;
}

export const projects: readonly Project[] = [
  {
    slug: 'questday',
    name: 'QuestDay',
    status: 'live',
    liveUrl: 'https://playquestday.com',
    stack: [
      'Next.js 16',
      'React 19',
      'Cloudflare Workers',
      'D1',
      'Hono',
      'GSAP',
      'next-intl',
      'Discord Embedded App SDK',
      'Vitest',
      'Playwright',
    ],
    hasCaseStudy: true,
    preview: { avif: '/previews/questday.avif', webp: '/previews/questday.webp' },
  },
  {
    slug: 'sakurai',
    name: 'SakurAI',
    status: 'live',
    liveUrl: 'https://www.getsakurai.com',
    stack: ['NestJS', 'MongoDB', 'Google Gemini', 'Angular'],
    hasCaseStudy: true,
    preview: { avif: '/previews/sakurai.avif', webp: '/previews/sakurai.webp' },
  },
  {
    slug: 'rally-voley',
    name: 'Rally Voley',
    status: 'building',
    liveUrl: null,
    // Spanish-only by design, so no next-intl (rally-voley spec §3).
    stack: ['Next.js 16', 'GSAP', 'Dexie', 'Cloudflare Workers', 'D1', 'Vitest', 'Playwright'],
    hasCaseStudy: true,
    preview: { avif: '/previews/rally-voley.avif', webp: '/previews/rally-voley.webp' },
  },
  {
    slug: 'yokaido',
    name: 'Yokaido',
    status: 'wip',
    liveUrl: null,
    stack: ['Godot 4'],
    hasCaseStudy: false,
    preview: null,
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export const caseStudySlugs: ProjectSlug[] = projects
  .filter((p) => p.hasCaseStudy)
  .map((p) => p.slug);

/** True for the slugs that have a case page (route params arrive as plain strings). */
export function isCaseStudySlug(slug: string): slug is ProjectSlug {
  return (caseStudySlugs as string[]).includes(slug);
}
