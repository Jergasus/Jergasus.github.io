import { expect, test } from 'vitest';
import { apps, getApp } from './apps';
import { caseStudySlugs } from '@/content/projects';

test('case apps equal caseStudySlugs', () => {
  expect(apps.filter((a) => a.route === 'case').map((a) => a.id)).toEqual(caseStudySlugs);
});

test('yokaido has no route and uses blue', () => {
  expect(getApp('yokaido')).toMatchObject({ route: null, colour: 'blue' });
});

test('terminal, browser and settings are interactive-only', () => {
  const interactive = new Set(['terminal', 'browser', 'settings']);
  for (const app of apps) {
    if (interactive.has(app.id)) {
      expect(app.interactiveOnly, `${app.id} should be interactiveOnly`).toBe(true);
    } else {
      expect(app.interactiveOnly, `${app.id} should not be interactiveOnly`).toBe(false);
    }
  }
});

// Task 5 adds the os.apps.* message keys; enable then.
test.todo('every app has os.apps.<key>.title and .label in es/ca/en');
