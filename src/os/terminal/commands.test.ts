import { describe, expect, it } from 'vitest';
import { runCommand } from './commands';
import type { TerminalResult } from './commands';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasKey(result: TerminalResult, key: string): boolean {
  return result.lines.some((l) => 'key' in l && l.key === key);
}

function allKeys(result: TerminalResult): string[] {
  return result.lines.flatMap((l) => ('key' in l ? [l.key] : []));
}

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe('runCommand: empty input', () => {
  it('returns no lines for empty string', () => {
    expect(runCommand('')).toEqual({ lines: [] });
  });

  it('returns no lines for whitespace-only input', () => {
    expect(runCommand('   ')).toEqual({ lines: [] });
  });
});

// ---------------------------------------------------------------------------
// ayuda / help / ajuda
// ---------------------------------------------------------------------------

describe('runCommand: ayuda', () => {
  it('returns help lines for "ayuda"', () => {
    const r = runCommand('ayuda');
    expect(r.lines.length).toBeGreaterThan(0);
    expect(allKeys(r).every((k) => k.startsWith('os.terminal.help.'))).toBe(true);
    expect(r.effect).toBeUndefined();
  });

  it('returns same help lines for "help"', () => {
    expect(runCommand('help')).toEqual(runCommand('ayuda'));
  });

  it('returns same help lines for "ajuda"', () => {
    expect(runCommand('ajuda')).toEqual(runCommand('ayuda'));
  });

  it('is case-insensitive', () => {
    expect(runCommand('AYUDA')).toEqual(runCommand('ayuda'));
    expect(runCommand('Help')).toEqual(runCommand('ayuda'));
  });

  it('trims whitespace', () => {
    expect(runCommand('  ayuda  ')).toEqual(runCommand('ayuda'));
  });
});

// ---------------------------------------------------------------------------
// proyectos / projects / projectes
// ---------------------------------------------------------------------------

describe('runCommand: proyectos', () => {
  it('returns one line per project in projects order', () => {
    const r = runCommand('proyectos');
    expect(r.lines).toHaveLength(4);
    expect(r.effect).toBeUndefined();
  });

  it('each line has key os.terminal.project with name and status values', () => {
    const r = runCommand('proyectos');
    for (const line of r.lines) {
      expect(line).toHaveProperty('key', 'os.terminal.project');
      if ('key' in line && line.values) {
        expect(typeof line.values.name).toBe('string');
        expect(typeof line.values.status).toBe('string');
        expect((line.values.status as string).startsWith('work.status.')).toBe(true);
      }
    }
  });

  it('status value is a message key string (not translated)', () => {
    const r = runCommand('proyectos');
    const lines = r.lines as Array<{ key: string; values: Record<string, string> }>;
    // questday is live
    expect(lines[0].values.status).toBe('work.status.live');
    // rally-voley is building
    expect(lines[2].values.status).toBe('work.status.building');
    // yokaido is wip
    expect(lines[3].values.status).toBe('work.status.wip');
  });

  it('project names match projects data order', () => {
    const r = runCommand('proyectos');
    const lines = r.lines as Array<{ key: string; values: Record<string, string> }>;
    expect(lines[0].values.name).toBe('QuestDay');
    expect(lines[1].values.name).toBe('SakurAI');
    expect(lines[2].values.name).toBe('Rally Voley');
    expect(lines[3].values.name).toBe('Yokaido');
  });

  it('"projects" alias works', () => {
    expect(runCommand('projects')).toEqual(runCommand('proyectos'));
  });

  it('"projectes" alias works', () => {
    expect(runCommand('projectes')).toEqual(runCommand('proyectos'));
  });
});

// ---------------------------------------------------------------------------
// abrir / open / obre — app word mapping
// ---------------------------------------------------------------------------

describe('runCommand: abrir <app>', () => {
  const openCases: Array<[string, string]> = [
    ['abrir sobre', 'about'],
    ['abrir about', 'about'],
    ['open sobre', 'about'],
    ['obre about', 'about'],
    ['abrir proyectos', 'projects'],
    ['abrir projects', 'projects'],
    ['abrir projectes', 'projects'],
    ['abrir actividad', 'activity'],
    ['abrir activity', 'activity'],
    ['abrir activitat', 'activity'],
    ['abrir contacto', 'contact'],
    ['abrir contact', 'contact'],
    ['abrir contacte', 'contact'],
    ['abrir nuevo', 'business'],
    ['abrir new', 'business'],
    ['abrir nou', 'business'],
    ['abrir navegador', 'browser'],
    ['abrir browser', 'browser'],
    ['abrir sistema', 'system'],
    ['abrir system', 'system'],
    ['abrir questday', 'questday'],
    ['abrir sakurai', 'sakurai'],
    ['abrir rally-voley', 'rally-voley'],
    ['abrir yokaido', 'yokaido'],
  ];

  for (const [input, expectedApp] of openCases) {
    it(`"${input}" → effect open: '${expectedApp}'`, () => {
      const r = runCommand(input);
      expect(r.effect).toEqual({ type: 'open', app: expectedApp });
    });
  }

  it('unknown app word → os.terminal.unknownApp line', () => {
    const r = runCommand('abrir foobar');
    expect(hasKey(r, 'os.terminal.unknownApp')).toBe(true);
    expect(r.effect).toBeUndefined();
  });

  it('open with no arg → os.terminal.unknownApp line', () => {
    const r = runCommand('open');
    expect(hasKey(r, 'os.terminal.unknownApp')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// contacto / contact / contacte
// ---------------------------------------------------------------------------

describe('runCommand: contacto', () => {
  it('returns effect open: contact and a line', () => {
    const r = runCommand('contacto');
    expect(r.effect).toEqual({ type: 'open', app: 'contact' });
    expect(hasKey(r, 'os.terminal.contact')).toBe(true);
  });

  it('"contact" alias works', () => {
    expect(runCommand('contact')).toEqual(runCommand('contacto'));
  });

  it('"contacte" alias works', () => {
    expect(runCommand('contacte')).toEqual(runCommand('contacto'));
  });
});

// ---------------------------------------------------------------------------
// sobre / about
// ---------------------------------------------------------------------------

describe('runCommand: sobre', () => {
  it('returns the os.terminal.about line and opens the about window, as its help line says', () => {
    const r = runCommand('sobre');
    expect(hasKey(r, 'os.terminal.about')).toBe(true);
    expect(r.effect).toEqual({ type: 'open', app: 'about' });
  });

  it('"about" alias works', () => {
    expect(runCommand('about')).toEqual(runCommand('sobre'));
  });
});

// ---------------------------------------------------------------------------
// idioma / lang
// ---------------------------------------------------------------------------

describe('runCommand: idioma', () => {
  it('"idioma es" → locale effect es', () => {
    expect(runCommand('idioma es').effect).toEqual({ type: 'locale', locale: 'es' });
  });

  it('"idioma ca" → locale effect ca', () => {
    expect(runCommand('idioma ca').effect).toEqual({ type: 'locale', locale: 'ca' });
  });

  it('"idioma en" → locale effect en', () => {
    expect(runCommand('idioma en').effect).toEqual({ type: 'locale', locale: 'en' });
  });

  it('"lang es" → locale effect es', () => {
    expect(runCommand('lang es').effect).toEqual({ type: 'locale', locale: 'es' });
  });

  it('"lang ca" → locale effect ca', () => {
    expect(runCommand('lang ca').effect).toEqual({ type: 'locale', locale: 'ca' });
  });

  it('"lang en" → locale effect en', () => {
    expect(runCommand('lang en').effect).toEqual({ type: 'locale', locale: 'en' });
  });

  it('bad locale → os.terminal.badLocale line', () => {
    const r = runCommand('idioma fr');
    expect(hasKey(r, 'os.terminal.badLocale')).toBe(true);
    expect(r.effect).toBeUndefined();
  });

  it('bad locale with lang alias → os.terminal.badLocale line', () => {
    expect(hasKey(runCommand('lang xx'), 'os.terminal.badLocale')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tema / theme
// ---------------------------------------------------------------------------

describe('runCommand: tema', () => {
  it('"tema dia" → theme light', () => {
    expect(runCommand('tema dia').effect).toEqual({ type: 'theme', theme: 'light' });
  });

  it('"tema noche" → theme dark', () => {
    expect(runCommand('tema noche').effect).toEqual({ type: 'theme', theme: 'dark' });
  });

  it('"tema nit" → theme dark', () => {
    expect(runCommand('tema nit').effect).toEqual({ type: 'theme', theme: 'dark' });
  });

  it('"theme day" → theme light', () => {
    expect(runCommand('theme day').effect).toEqual({ type: 'theme', theme: 'light' });
  });

  it('"theme night" → theme dark', () => {
    expect(runCommand('theme night').effect).toEqual({ type: 'theme', theme: 'dark' });
  });

  it('locale effects return no extra lines', () => {
    expect(runCommand('tema dia').lines).toHaveLength(0);
    expect(runCommand('tema noche').lines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// limpiar / clear / neteja
// ---------------------------------------------------------------------------

describe('runCommand: limpiar', () => {
  it('"limpiar" → effect clear', () => {
    expect(runCommand('limpiar').effect).toEqual({ type: 'clear' });
  });

  it('"clear" alias works', () => {
    expect(runCommand('clear').effect).toEqual({ type: 'clear' });
  });

  it('"neteja" alias works', () => {
    expect(runCommand('neteja').effect).toEqual({ type: 'clear' });
  });

  it('clear returns no lines', () => {
    expect(runCommand('clear').lines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sudo contratar / sudo hire / sudo contractar
// ---------------------------------------------------------------------------

describe('runCommand: sudo contratar', () => {
  it('"sudo contratar" → os.terminal.sudo line + effect open: contact', () => {
    const r = runCommand('sudo contratar');
    expect(hasKey(r, 'os.terminal.sudo')).toBe(true);
    expect(r.effect).toEqual({ type: 'open', app: 'contact' });
  });

  it('"sudo hire" → same as sudo contratar', () => {
    expect(runCommand('sudo hire')).toEqual(runCommand('sudo contratar'));
  });

  it('"sudo contractar" → same as sudo contratar', () => {
    expect(runCommand('sudo contractar')).toEqual(runCommand('sudo contratar'));
  });
});

// ---------------------------------------------------------------------------
// Unknown command
// ---------------------------------------------------------------------------

describe('runCommand: unknown command', () => {
  it('unknown command → os.terminal.unknown line with cmd value', () => {
    const r = runCommand('foobar');
    expect(hasKey(r, 'os.terminal.unknown')).toBe(true);
    const line = r.lines.find((l) => 'key' in l && l.key === 'os.terminal.unknown');
    expect(line).toBeDefined();
    if (line && 'key' in line) {
      expect(line.values?.cmd).toBe('foobar');
    }
  });

  it('preserves original casing of unknown cmd', () => {
    const r = runCommand('FooBar');
    const line = r.lines.find((l) => 'key' in l && l.key === 'os.terminal.unknown') as
      | { key: string; values: Record<string, string> }
      | undefined;
    expect(line?.values?.cmd).toBe('FooBar');
  });

  it('unknown has no effect', () => {
    expect(runCommand('foobar').effect).toBeUndefined();
  });
});
