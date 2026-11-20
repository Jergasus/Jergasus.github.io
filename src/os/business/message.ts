export type BusinessKind = 'hospitality' | 'beauty' | 'shop' | 'other';
export type NeedKind = 'new-site' | 'redesign' | 'bookings' | 'menu' | 'other';

export interface ProjectBrief {
  business: BusinessKind;
  needs: NeedKind[];
  name: string;
  details: string;
}

/** Details beyond this length are trimmed and suffixed with "…". */
export const DETAILS_MAX = 500;

// ---------------------------------------------------------------------------
// NeedKind → camelCase key (matches JSON key in os.wizard.needs.<key>)
// ---------------------------------------------------------------------------

const NEED_KIND_KEY: Record<NeedKind, string> = {
  'new-site': 'newSite',
  redesign: 'redesign',
  bookings: 'bookings',
  menu: 'menu',
  other: 'other',
};

// ---------------------------------------------------------------------------
// buildProjectMessage
// ---------------------------------------------------------------------------

/**
 * Builds a WhatsApp/email message string from a project brief.
 * Returns message keys only via the translator `t`; components supply the
 * actual translations. Lines are joined with "\n".
 *
 * Keys used (added to messages by Task 10):
 *   os.wizard.message.greeting
 *   os.wizard.message.business  { business }
 *   os.wizard.message.needs     { needs }
 *   os.wizard.message.name      { name }
 *   os.wizard.message.details   { details }
 *   os.wizard.business.<kind>
 *   os.wizard.needs.<kind>  (camelCase, e.g. newSite)
 */
export function buildProjectMessage(
  brief: ProjectBrief,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const businessLabel = t(`os.wizard.business.${brief.business}`);
  const needLabels = brief.needs.map((n) => t(`os.wizard.needs.${NEED_KIND_KEY[n]}`));

  const lines: string[] = [
    t('os.wizard.message.greeting'),
    t('os.wizard.message.business', { business: businessLabel }),
    t('os.wizard.message.needs', { needs: needLabels.join(', ') }),
  ];

  if (brief.name.trim()) {
    lines.push(t('os.wizard.message.name', { name: brief.name }));
  }

  if (brief.details.trim()) {
    const raw = brief.details;
    const trimmed = raw.length > DETAILS_MAX ? raw.slice(0, DETAILS_MAX) + '…' : raw;
    lines.push(t('os.wizard.message.details', { details: trimmed }));
  }

  return lines.join('\n');
}
