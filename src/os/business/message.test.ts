import { describe, expect, it } from 'vitest';
import { buildProjectMessage, DETAILS_MAX } from './message';
import type { ProjectBrief } from './message';
import { whatsappHref } from '@/content/contact';

// ---------------------------------------------------------------------------
// Fake translator — returns readable Spanish-like strings, no price words.
// ---------------------------------------------------------------------------

function fakeT(key: string, values?: Record<string, string>): string {
  switch (key) {
    case 'os.wizard.message.greeting':
      return 'Hola Jesús, ';
    case 'os.wizard.message.business':
      return `tengo ${values?.business}.`;
    case 'os.wizard.message.needs':
      return `Necesito: ${values?.needs}.`;
    case 'os.wizard.message.name':
      return `Me llamo ${values?.name}.`;
    case 'os.wizard.message.details':
      return `Detalles: ${values?.details}.`;
    case 'os.wizard.business.hospitality':
      return 'un hostal';
    case 'os.wizard.business.beauty':
      return 'una peluquería';
    case 'os.wizard.business.shop':
      return 'una tienda';
    case 'os.wizard.business.other':
      return 'un negocio';
    case 'os.wizard.needs.newSite':
      return 'nueva web';
    case 'os.wizard.needs.redesign':
      return 'rediseño';
    case 'os.wizard.needs.bookings':
      return 'reservas';
    case 'os.wizard.needs.menu':
      return 'menú';
    case 'os.wizard.needs.other':
      return 'otras';
    default:
      return key;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fullBrief: ProjectBrief = {
  business: 'hospitality',
  needs: ['new-site', 'bookings'],
  name: 'Casa Rural El Pino',
  details: 'Queremos algo moderno y fácil de mantener.',
};

// ---------------------------------------------------------------------------
// Basic structure
// ---------------------------------------------------------------------------

describe('buildProjectMessage: structure', () => {
  it('includes greeting', () => {
    expect(buildProjectMessage(fullBrief, fakeT)).toContain('Hola Jesús');
  });

  it('includes translated business kind', () => {
    expect(buildProjectMessage(fullBrief, fakeT)).toContain('un hostal');
  });

  it('includes comma-joined need labels', () => {
    const msg = buildProjectMessage(fullBrief, fakeT);
    expect(msg).toContain('nueva web');
    expect(msg).toContain('reservas');
  });

  it('includes name when provided', () => {
    expect(buildProjectMessage(fullBrief, fakeT)).toContain('Casa Rural El Pino');
  });

  it('includes details when provided', () => {
    expect(buildProjectMessage(fullBrief, fakeT)).toContain(
      'Queremos algo moderno y fácil de mantener.',
    );
  });

  it('lines are joined with newline', () => {
    const msg = buildProjectMessage(fullBrief, fakeT);
    expect(msg.includes('\n')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Optional fields
// ---------------------------------------------------------------------------

describe('buildProjectMessage: optional fields', () => {
  it('omits name line when name is empty', () => {
    const brief: ProjectBrief = { ...fullBrief, name: '' };
    expect(buildProjectMessage(brief, fakeT)).not.toContain('Me llamo');
  });

  it('omits name line when name is whitespace', () => {
    const brief: ProjectBrief = { ...fullBrief, name: '   ' };
    expect(buildProjectMessage(brief, fakeT)).not.toContain('Me llamo');
  });

  it('omits details line when details is empty', () => {
    const brief: ProjectBrief = { ...fullBrief, details: '' };
    expect(buildProjectMessage(brief, fakeT)).not.toContain('Detalles:');
  });

  it('omits details line when details is whitespace', () => {
    const brief: ProjectBrief = { ...fullBrief, details: '   ' };
    expect(buildProjectMessage(brief, fakeT)).not.toContain('Detalles:');
  });
});

// ---------------------------------------------------------------------------
// DETAILS_MAX trimming
// ---------------------------------------------------------------------------

describe('buildProjectMessage: details trimming', () => {
  it('DETAILS_MAX is 500', () => {
    expect(DETAILS_MAX).toBe(500);
  });

  it('details within limit are not trimmed', () => {
    const brief: ProjectBrief = { ...fullBrief, details: 'a'.repeat(DETAILS_MAX) };
    const msg = buildProjectMessage(brief, fakeT);
    // No ellipsis appended when exactly at limit
    const detailsLine = msg.split('\n').find((l) => l.startsWith('Detalles:')) ?? '';
    expect(detailsLine).not.toContain('…');
  });

  it('details over limit are trimmed to DETAILS_MAX chars + ellipsis', () => {
    const longDetails = 'x'.repeat(DETAILS_MAX + 10);
    const brief: ProjectBrief = { ...fullBrief, details: longDetails };
    const msg = buildProjectMessage(brief, fakeT);
    const detailsLine = msg.split('\n').find((l) => l.startsWith('Detalles:')) ?? '';
    expect(detailsLine).toContain('…');
    // The first DETAILS_MAX x's should be present
    expect(detailsLine).toContain('x'.repeat(10)); // at least some x's
    // The full long details should not be present
    expect(msg).not.toContain('x'.repeat(DETAILS_MAX + 10));
  });

  it('trimmed string passed to t() contains exactly DETAILS_MAX chars before the ellipsis', () => {
    const longDetails = 'x'.repeat(DETAILS_MAX + 50);
    const brief: ProjectBrief = { ...fullBrief, details: longDetails };
    const msg = buildProjectMessage(brief, fakeT);
    // Extract the details value from the fakeT output: "Detalles: <value>."
    const detailsLine = msg.split('\n').find((l) => l.startsWith('Detalles:')) ?? '';
    // fakeT('os.wizard.message.details', { details: v }) → "Detalles: v."
    // So extract the value between "Detalles: " and the final "."
    const inner = detailsLine.slice('Detalles: '.length, -1);
    expect(inner).toHaveLength(DETAILS_MAX + 1); // DETAILS_MAX chars + '…'
    expect(inner.endsWith('…')).toBe(true);
    expect(inner.slice(0, DETAILS_MAX)).toBe('x'.repeat(DETAILS_MAX));
  });
});

// ---------------------------------------------------------------------------
// No price words
// ---------------------------------------------------------------------------

describe('buildProjectMessage: no price words', () => {
  const priceBriefs: ProjectBrief[] = [
    { business: 'hospitality', needs: ['new-site'], name: 'Test', details: 'some info' },
    { business: 'beauty', needs: ['redesign', 'bookings'], name: '', details: '' },
    { business: 'shop', needs: ['menu', 'other'], name: 'El Nombre', details: 'Detalles.' },
    { business: 'other', needs: ['other'], name: '', details: 'Other details.' },
  ];

  for (const brief of priceBriefs) {
    it(`business=${brief.business} contains no price words`, () => {
      const msg = buildProjectMessage(brief, fakeT);
      expect(msg).not.toMatch(/€|\$|precio|preu|price/i);
    });
  }
});

// ---------------------------------------------------------------------------
// WhatsApp round-trip
// ---------------------------------------------------------------------------

describe('buildProjectMessage: whatsappHref round-trip', () => {
  it('output encodes and decodes correctly through whatsappHref', () => {
    const msg = buildProjectMessage(fullBrief, fakeT);
    const href = whatsappHref(msg);
    expect(href).toMatch(/^https:\/\/wa\.me\//);
    const url = new URL(href);
    const decoded = decodeURIComponent(url.searchParams.get('text') ?? '');
    expect(decoded).toBe(msg);
  });

  it('special characters in details survive round-trip', () => {
    const brief: ProjectBrief = {
      ...fullBrief,
      details: 'Queremos & más: café, peluquería.',
    };
    const msg = buildProjectMessage(brief, fakeT);
    const href = whatsappHref(msg);
    const url = new URL(href);
    const decoded = decodeURIComponent(url.searchParams.get('text') ?? '');
    expect(decoded).toBe(msg);
  });
});

// ---------------------------------------------------------------------------
// Need kind camelCase mapping
// ---------------------------------------------------------------------------

describe('buildProjectMessage: need kind key mapping', () => {
  it('new-site maps to newSite key', () => {
    const brief: ProjectBrief = { ...fullBrief, needs: ['new-site'] };
    expect(buildProjectMessage(brief, fakeT)).toContain('nueva web');
  });

  it('redesign maps to redesign key', () => {
    const brief: ProjectBrief = { ...fullBrief, needs: ['redesign'] };
    expect(buildProjectMessage(brief, fakeT)).toContain('rediseño');
  });

  it('bookings maps to bookings key', () => {
    const brief: ProjectBrief = { ...fullBrief, needs: ['bookings'] };
    expect(buildProjectMessage(brief, fakeT)).toContain('reservas');
  });

  it('menu maps to menu key', () => {
    const brief: ProjectBrief = { ...fullBrief, needs: ['menu'] };
    expect(buildProjectMessage(brief, fakeT)).toContain('menú');
  });

  it('other maps to other key', () => {
    const brief: ProjectBrief = { ...fullBrief, needs: ['other'] };
    expect(buildProjectMessage(brief, fakeT)).toContain('otras');
  });

  it('multiple needs are joined with comma + space', () => {
    const brief: ProjectBrief = { ...fullBrief, needs: ['new-site', 'bookings'] };
    const msg = buildProjectMessage(brief, fakeT);
    expect(msg).toContain('nueva web, reservas');
  });
});

// ---------------------------------------------------------------------------
// All business kinds
// ---------------------------------------------------------------------------

describe('buildProjectMessage: business kind mapping', () => {
  const businessCases: Array<[ProjectBrief['business'], string]> = [
    ['hospitality', 'un hostal'],
    ['beauty', 'una peluquería'],
    ['shop', 'una tienda'],
    ['other', 'un negocio'],
  ];

  for (const [kind, expectedLabel] of businessCases) {
    it(`business=${kind} → includes "${expectedLabel}"`, () => {
      const brief: ProjectBrief = { ...fullBrief, business: kind };
      expect(buildProjectMessage(brief, fakeT)).toContain(expectedLabel);
    });
  }
});
