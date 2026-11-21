import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import es from '../../messages/es.json';
import ca from '../../messages/ca.json';
import en from '../../messages/en.json';

// Content rules from the spec (§2 anti-goals, §3.2, §3.4) checked over every
// string in every messages file, so a copy edit cannot quietly break them.

type Entry = [path: string, value: string];

function entries(node: unknown, path = ''): Entry[] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, value]) =>
      entries(value, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

// Yokaido is turning single-player; its copy must never promise otherwise.
const COOP_CLAIM =
  /co-?op|cooperativ|online|en l[ií]ne[a]|en l[ií]nia|multiplayer|multijugador|steam/i;
// Spain Spanish addresses the reader as tú.
const FORMAL_ADDRESS = /\busted\b|\bvosotros\b/i;
// No em dash in any visible copy, in any locale.
const EM_DASH = /—/;
// Catalan and English write the curly apostrophe (’): l’idioma, I’d.
const STRAIGHT_APOSTROPHE = /[A-Za-zÀ-ÿ]'[A-Za-zÀ-ÿ]/;
// One ellipsis character everywhere (Personalizar…), never three dots.
const THREE_DOTS = /\.\.\./;

// Projects that must never be mentioned are listed in an untracked local file.
const __dir = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN_TERMS_PATH = resolve(__dir, '../../content/forbidden-terms.local.txt');
const hasForbiddenTerms = existsSync(FORBIDDEN_TERMS_PATH);

function buildForbiddenPattern(filePath: string): RegExp {
  const lines = readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  const alt = lines.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(alt, 'i');
}

const FORBIDDEN_PROJECT = hasForbiddenTerms ? buildForbiddenPattern(FORBIDDEN_TERMS_PATH) : null;

const yokaidoClaims = (messages: unknown) =>
  entries(messages).filter(
    ([path, value]) => path.toLowerCase().includes('yokaido') && COOP_CLAIM.test(value),
  );
const forbiddenMentions = (messages: unknown, pattern: RegExp | null = FORBIDDEN_PROJECT) =>
  pattern ? entries(messages).filter(([, value]) => pattern.test(value)) : [];
const formalAddress = (messages: unknown) =>
  entries(messages).filter(([, value]) => FORMAL_ADDRESS.test(value));
const emDashes = (messages: unknown) => entries(messages).filter(([, value]) => EM_DASH.test(value));
const straightApostrophes = (messages: unknown) =>
  entries(messages).filter(([, value]) => STRAIGHT_APOSTROPHE.test(value));

const LOCALES = { es, ca, en };
const CASE_KEYS = ['questday', 'sakurai', 'rallyVoley'] as const;

describe('copy rules', () => {
  it('the guards catch what they guard', () => {
    expect(yokaidoClaims({ projects: { yokaido: { oneLiner: 'Un juego cooperativo' } } })).toHaveLength(1);
    expect(yokaidoClaims({ about: { yokaidoNote: 'Coming to Steam' } })).toHaveLength(1);
    // Other projects may mention Steam (QuestDay's percent game uses its data).
    expect(yokaidoClaims({ projects: { questday: { oneLiner: 'Steam' } } })).toHaveLength(0);
    // Test the forbidden-mentions matcher with neutral fake terms.
    const fakePattern = /acme corp/i;
    expect(forbiddenMentions({ work: { title: 'Acme Corp' } }, fakePattern)).toHaveLength(1);
    expect(forbiddenMentions({ work: { title: 'Different Studio' } }, fakePattern)).toHaveLength(0);
    expect(formalAddress({ hero: { lede: 'Si usted quiere una web' } })).toHaveLength(1);
    expect(formalAddress({ hero: { lede: 'Si quieres una web' } })).toHaveLength(0);
    expect(emDashes({ os: { help: 'ayuda — muestra esta ayuda' } })).toHaveLength(1);
    expect(emDashes({ os: { help: 'ayuda: muestra esta ayuda' } })).toHaveLength(0);
    expect(straightApostrophes({ menu: { heading: "Fons d'escriptori" } })).toHaveLength(1);
    expect(straightApostrophes({ menu: { heading: 'Fons d’escriptori' } })).toHaveLength(0);
    // Quotes around a word are not apostrophes.
    expect(straightApostrophes({ terminal: { hint: "Type 'help'" } })).toHaveLength(0);
  });

  it('no em dash in any locale', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      expect(emDashes(messages), locale).toEqual([]);
    }
  });

  it('catalan and english use the curly apostrophe', () => {
    expect(straightApostrophes(ca), 'ca').toEqual([]);
    expect(straightApostrophes(en), 'en').toEqual([]);
  });

  it('an ellipsis is one character in every locale', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      expect(entries(messages).filter(([, value]) => THREE_DOTS.test(value)), locale).toEqual([]);
    }
  });

  it('yokaido copy never claims co-op', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      expect(yokaidoClaims(messages), locale).toEqual([]);
    }
  });

  it.skipIf(!hasForbiddenTerms)('forbidden projects never mentioned', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      expect(forbiddenMentions(messages), locale).toEqual([]);
    }
  });

  it('spanish uses tú', () => {
    expect(formalAddress(es)).toEqual([]);
  });

  it('every case study is complete in every locale', () => {
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const studies = (messages as { caseStudies?: Record<string, unknown> }).caseStudies ?? {};
      for (const key of CASE_KEYS) {
        const study = (studies[key] ?? {}) as Record<string, unknown>;
        const where = `${locale} caseStudies.${key}`;
        for (const field of ['title', 'summary', 'problem', 'built', 'stackNote']) {
          expect(study[field], `${where}.${field}`).toEqual(expect.stringMatching(/\S/));
        }
        const decisions = study.decisions;
        expect(Array.isArray(decisions), `${where}.decisions is a list`).toBe(true);
        const list = decisions as { title?: unknown; body?: unknown }[];
        expect(list.length, `${where}.decisions has 3 to 5 items`).toBeGreaterThanOrEqual(3);
        expect(list.length, `${where}.decisions has 3 to 5 items`).toBeLessThanOrEqual(5);
        for (const decision of list) {
          expect(decision.title, `${where} decision title`).toEqual(expect.stringMatching(/\S/));
          expect(decision.body, `${where} decision body`).toEqual(expect.stringMatching(/\S/));
        }
      }
    }
  });
});
