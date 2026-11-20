import { expect, test } from 'vitest';
import { caseHref, routedSlugOf } from './route';

test('a case page routes its project in every locale, with or without the trailing slash', () => {
  expect(routedSlugOf('/work/questday/')).toBe('questday');
  expect(routedSlugOf('/work/sakurai')).toBe('sakurai');
  expect(routedSlugOf('/ca/work/rally-voley/')).toBe('rally-voley');
  expect(routedSlugOf('/en/work/questday')).toBe('questday');
});

test('home, unknown pages and yokaido route nothing', () => {
  for (const path of ['/', '/ca/', '/en', '', null, '/work/', '/work/yokaido/', '/work/nope/', '/work/questday/extra/', '/es/work/questday/']) {
    expect(routedSlugOf(path), String(path)).toBeNull();
  }
});

test('case hrefs are unprefixed paths with a trailing slash (the router adds the locale)', () => {
  expect(caseHref('rally-voley')).toBe('/work/rally-voley/');
  expect(caseHref(null)).toBe('/');
});
