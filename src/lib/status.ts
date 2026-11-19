import rawJson from '../../content/status.json';
import type { Locale } from '@/i18n/routing';

type LocaleText = { es: string; ca: string; en: string };

/**
 * content/status.json, edited by hand (spec §4):
 * - `available`: whether Jesús is taking new projects;
 * - `availabilityLabel` (optional): custom wording for the hero. Without it
 *   the hero says the default for the current state (messages
 *   hero.availability.*), so flipping `available` is all it takes. A custom
 *   label replaces that, so it has to change whenever `available` does;
 * - `currentlyBuilding`: one line per locale (empty: the most recently
 *   committed project's name).
 */
export type Status = {
  available: boolean;
  availabilityLabel?: LocaleText;
  currentlyBuilding: LocaleText;
};

function isLocaleMap(val: unknown): val is LocaleText {
  if (typeof val !== 'object' || val === null) return false;
  const v = val as Record<string, unknown>;
  return typeof v.es === 'string' && typeof v.ca === 'string' && typeof v.en === 'string';
}

export function parseStatus(raw: unknown): Status {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid status.json: root');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.available !== 'boolean') {
    throw new Error('Invalid status.json: available');
  }
  if (r.availabilityLabel !== undefined && !isLocaleMap(r.availabilityLabel)) {
    throw new Error('Invalid status.json: availabilityLabel');
  }
  if (!isLocaleMap(r.currentlyBuilding)) {
    throw new Error('Invalid status.json: currentlyBuilding');
  }
  return {
    available: r.available,
    ...(r.availabilityLabel ? { availabilityLabel: r.availabilityLabel } : {}),
    currentlyBuilding: r.currentlyBuilding,
  };
}

/** The hero's availability text: the custom label if there is one, else the state's default. */
export function availabilityLabel(
  status: Status,
  locale: Locale,
  defaults: { available: string; unavailable: string },
): string {
  const custom = status.availabilityLabel?.[locale].trim();
  if (custom) return custom;
  return status.available ? defaults.available : defaults.unavailable;
}

export const status = parseStatus(rawJson);
