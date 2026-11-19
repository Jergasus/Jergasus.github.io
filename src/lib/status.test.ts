import { describe, expect, it } from 'vitest';
import rawJson from '../../content/status.json';
import es from '../../messages/es.json';
import en from '../../messages/en.json';
import { availabilityLabel, parseStatus } from './status';

const building = { es: 'x', ca: 'y', en: 'z' };

describe('parseStatus', () => {
  it('accepts the committed status.json', () => {
    expect(() => parseStatus(rawJson)).not.toThrow();
  });

  it('accepts a status without an availability label (spec §4: the label is optional)', () => {
    expect(parseStatus({ available: false, currentlyBuilding: building }).availabilityLabel).toBeUndefined();
  });

  it('throws when availabilityLabel is missing the ca locale', () => {
    const bad = {
      available: true,
      availabilityLabel: { es: 'foo', en: 'bar' }, // ca missing
      currentlyBuilding: building,
    };
    expect(() => parseStatus(bad)).toThrow('Invalid status.json:');
  });

  it('throws when available is "yes" instead of a boolean', () => {
    const bad = {
      available: 'yes',
      availabilityLabel: { es: 'foo', ca: 'bar', en: 'baz' },
      currentlyBuilding: building,
    };
    expect(() => parseStatus(bad)).toThrow('Invalid status.json:');
  });
});

describe('availabilityLabel', () => {
  it('without a label, says what the boolean says', () => {
    const notTaking = parseStatus({ available: false, currentlyBuilding: building });
    expect(availabilityLabel(notTaking, 'en', en.hero.availability)).toBe('Not taking projects right now');
    expect(availabilityLabel(notTaking, 'es', es.hero.availability)).toBe(es.hero.availability.unavailable);

    const taking = parseStatus({ available: true, currentlyBuilding: building });
    expect(availabilityLabel(taking, 'en', en.hero.availability)).toBe('Taking new projects');
  });

  it('a label in status.json overrides the default wording', () => {
    const status = parseStatus({
      available: true,
      availabilityLabel: { es: 'Agenda abierta en enero', ca: 'Agenda oberta al gener', en: 'Booking January' },
      currentlyBuilding: building,
    });
    expect(availabilityLabel(status, 'en', en.hero.availability)).toBe('Booking January');
  });
});
