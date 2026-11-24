import { expect, test } from 'vitest';
import { apps, getApp, DESKTOP_ICON_ORDER, PHONE_ICON_ORDER } from './apps';
import { caseStudySlugs } from '@/content/projects';
import es from '../../messages/es.json';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';

test('case apps equal caseStudySlugs', () => {
  expect(apps.filter((a) => a.route === 'case').map((a) => a.id)).toEqual(caseStudySlugs);
});

test('yokaido has no route and uses blue', () => {
  expect(getApp('yokaido')).toMatchObject({ route: null, colour: 'blue' });
});

test('terminal, browser and settings are interactive-only, and only they are left out of the document', () => {
  const interactive = new Set(['terminal', 'browser', 'settings']);
  for (const app of apps) {
    if (interactive.has(app.id)) {
      expect(app.interactiveOnly, `${app.id} should be interactiveOnly`).toBe(true);
    } else {
      expect(app.interactiveOnly, `${app.id} should not be interactiveOnly`).toBe(false);
    }
  }
});

test('every app has os.apps.<key>.title and .label in es/ca/en', () => {
  for (const [locale, messages] of Object.entries({ es, ca, en })) {
    const entries = messages.os.apps as Record<string, { title?: string; label?: string } | undefined>;
    for (const app of apps) {
      const where = `${locale} os.apps.${app.messageKey}`;
      expect(entries[app.messageKey]?.title, `${where}.title`).toEqual(expect.stringMatching(/\S/));
      expect(entries[app.messageKey]?.label, `${where}.label`).toEqual(expect.stringMatching(/\S/));
    }
  }
});

test('Bienvenida is first on the desktop; icon flags agree with the order arrays', () => {
  expect(DESKTOP_ICON_ORDER).toEqual(['welcome', 'about', 'projects', 'questday', 'sakurai', 'rally-voley', 'yokaido', 'activity', 'business', 'contact', 'terminal', 'browser', 'settings']);
  expect(PHONE_ICON_ORDER).toEqual(['questday', 'sakurai', 'rally-voley', 'yokaido', 'about', 'activity', 'business', 'contact', 'terminal', 'browser', 'system', 'settings']);
  for (const app of apps) {
    expect(app.desktopIcon, app.id).toBe(DESKTOP_ICON_ORDER.includes(app.id));
    expect(app.phoneIcon, app.id).toBe(PHONE_ICON_ORDER.includes(app.id));
  }
});


test('project apps are titled with the project name in every locale', () => {
  for (const messages of [es, ca, en]) {
    expect(messages.os.apps.questday).toEqual({ title: 'QuestDay', label: 'QuestDay' });
    expect(messages.os.apps.sakurai).toEqual({ title: 'SakurAI', label: 'SakurAI' });
    expect(messages.os.apps.rallyVoley).toEqual({ title: 'Rally Voley', label: 'Rally Voley' });
  }
});
