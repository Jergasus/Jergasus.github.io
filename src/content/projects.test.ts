import { describe, expect, it } from 'vitest';
import { caseStudySlugs, getProject, isCaseStudySlug, projects } from './projects';

describe('projects', () => {
  it('order is questday, sakurai, rally-voley, yokaido', () => {
    expect(projects.map((p) => p.slug)).toEqual(['questday', 'sakurai', 'rally-voley', 'yokaido']);
  });

  it('yokaido has hasCaseStudy false, liveUrl null, status wip', () => {
    const yokaido = projects.find((p) => p.slug === 'yokaido');
    expect(yokaido?.hasCaseStudy).toBe(false);
    expect(yokaido?.liveUrl).toBeNull();
    expect(yokaido?.status).toBe('wip');
  });

  it('rally-voley has liveUrl null', () => {
    const rally = projects.find((p) => p.slug === 'rally-voley');
    expect(rally?.liveUrl).toBeNull();
  });

  // The case page lists the whole stack, so it must match the repo. Rally
  // Voley is Spanish-only by design ("No next-intl: one language", its
  // docs/superpowers/specs/2026-11-15-rally-voley-design.md §3).
  it('rally-voley stack has no next-intl', () => {
    const rally = projects.find((p) => p.slug === 'rally-voley');
    expect(rally?.stack).not.toContain('next-intl');
  });

  it('caseStudySlugs equals first three slugs', () => {
    expect(caseStudySlugs).toEqual(['questday', 'sakurai', 'rally-voley']);
  });

  it('getProject returns the matching project', () => {
    expect(getProject('questday')?.name).toBe('QuestDay');
  });

  it('isCaseStudySlug accepts only the three case studies', () => {
    expect(caseStudySlugs.every(isCaseStudySlug)).toBe(true);
    expect(isCaseStudySlug('yokaido')).toBe(false);
    expect(isCaseStudySlug('unknown')).toBe(false);
  });

  it('getProject returns undefined for unknown slug', () => {
    expect(getProject('unknown')).toBeUndefined();
  });
});
