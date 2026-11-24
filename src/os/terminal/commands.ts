import type { AppId } from '@/os/apps';
import type { Locale } from '@/i18n/routing';
import { projects } from '@/content/projects';

export type TerminalLine =
  | { key: string; values?: Record<string, string | number> }
  | { raw: string };

export type TerminalEffect =
  | { type: 'open'; app: AppId }
  | { type: 'locale'; locale: Locale }
  | { type: 'theme'; theme: 'light' | 'dark' }
  | { type: 'clear' };

export interface TerminalResult {
  lines: TerminalLine[];
  effect?: TerminalEffect;
}

// ---------------------------------------------------------------------------
// App word → AppId mapping
// ---------------------------------------------------------------------------

const APP_WORDS: Record<string, AppId> = {
  bienvenida: 'welcome',
  welcome: 'welcome',
  benvinguda: 'welcome',
  sobre: 'about',
  about: 'about',
  proyectos: 'projects',
  projects: 'projects',
  projectes: 'projects',
  actividad: 'activity',
  activity: 'activity',
  activitat: 'activity',
  contacto: 'contact',
  contact: 'contact',
  contacte: 'contact',
  nuevo: 'business',
  new: 'business',
  nou: 'business',
  navegador: 'browser',
  browser: 'browser',
  sistema: 'system',
  system: 'system',
  questday: 'questday',
  sakurai: 'sakurai',
  'rally-voley': 'rally-voley',
  yokaido: 'yokaido',
};

// ---------------------------------------------------------------------------
// Help lines (keys only — Task 5 adds the os namespace messages)
// ---------------------------------------------------------------------------

const HELP_LINES: TerminalLine[] = [
  { key: 'os.terminal.help.ayuda' },
  { key: 'os.terminal.help.proyectos' },
  { key: 'os.terminal.help.abrir' },
  { key: 'os.terminal.help.contacto' },
  { key: 'os.terminal.help.sobre' },
  { key: 'os.terminal.help.idioma' },
  { key: 'os.terminal.help.tema' },
  { key: 'os.terminal.help.limpiar' },
  { key: 'os.terminal.help.sudo' },
];

// ---------------------------------------------------------------------------
// runCommand
// ---------------------------------------------------------------------------

export function runCommand(input: string): TerminalResult {
  const normalized = input.trim();
  if (!normalized) {
    return { lines: [] };
  }

  const lower = normalized.toLowerCase();
  const parts = lower.split(/\s+/);
  const verb = parts[0];
  const arg = parts.slice(1).join(' ');

  // ayuda / help / ajuda
  if (verb === 'ayuda' || verb === 'help' || verb === 'ajuda') {
    return { lines: HELP_LINES };
  }

  // proyectos / projects / projectes
  if (verb === 'proyectos' || verb === 'projects' || verb === 'projectes') {
    return {
      lines: projects.map((p) => ({
        key: 'os.terminal.project',
        values: { name: p.name, status: `work.status.${p.status}` },
      })),
    };
  }

  // abrir <app> / open <app> / obre <app>
  if (verb === 'abrir' || verb === 'open' || verb === 'obre') {
    const appId = APP_WORDS[arg];
    if (appId !== undefined) {
      return { lines: [], effect: { type: 'open', app: appId } };
    }
    return { lines: [{ key: 'os.terminal.unknownApp', values: { app: arg } }] };
  }

  // contacto / contact / contacte
  if (verb === 'contacto' || verb === 'contact' || verb === 'contacte') {
    return {
      lines: [{ key: 'os.terminal.contact' }],
      effect: { type: 'open', app: 'contact' },
    };
  }

  // sobre / about: one line, and the about window opens
  if (verb === 'sobre' || verb === 'about') {
    return {
      lines: [{ key: 'os.terminal.about' }],
      effect: { type: 'open', app: 'about' },
    };
  }

  // idioma <es|ca|en> / lang <es|ca|en>
  if (verb === 'idioma' || verb === 'lang') {
    if (arg === 'es' || arg === 'ca' || arg === 'en') {
      return { lines: [], effect: { type: 'locale', locale: arg as Locale } };
    }
    return { lines: [{ key: 'os.terminal.badLocale', values: { locale: arg } }] };
  }

  // tema <dia|noche|nit> / theme <day|night>
  if (verb === 'tema' || verb === 'theme') {
    if (arg === 'dia' || arg === 'day') {
      return { lines: [], effect: { type: 'theme', theme: 'light' } };
    }
    if (arg === 'noche' || arg === 'nit' || arg === 'night') {
      return { lines: [], effect: { type: 'theme', theme: 'dark' } };
    }
    // unknown theme word falls through to unknown command
  }

  // limpiar / clear / neteja
  if (verb === 'limpiar' || verb === 'clear' || verb === 'neteja') {
    return { lines: [], effect: { type: 'clear' } };
  }

  // sudo contratar / sudo hire / sudo contractar
  if (verb === 'sudo' && (arg === 'contratar' || arg === 'hire' || arg === 'contractar')) {
    return {
      lines: [{ key: 'os.terminal.sudo' }],
      effect: { type: 'open', app: 'contact' },
    };
  }

  // unknown command — preserve original casing
  return { lines: [{ key: 'os.terminal.unknown', values: { cmd: normalized } }] };
}
