import { describe, expect, it } from 'vitest';
import { contact, mailtoHref, whatsappHref } from './contact';

describe('contact', () => {
  it('whatsappHref encodes the message correctly', () => {
    expect(whatsappHref('Hola Jesús')).toBe('https://wa.me/34633732440?text=Hola%20Jes%C3%BAs');
  });

  it('mailtoHref without subject returns bare mailto', () => {
    expect(mailtoHref()).toBe('mailto:jergasus04@gmail.com');
  });

  it('linkedin pathname decodes to the expected value', () => {
    expect(decodeURIComponent(new URL(contact.linkedin).pathname)).toBe(
      '/in/jesús-josé-garcía-ayala-716294331/',
    );
  });

  it('mailtoHref with subject and body encodes both', () => {
    expect(mailtoHref('Hola', 'a b&c')).toBe(
      'mailto:jergasus04@gmail.com?subject=Hola&body=a%20b%26c',
    );
  });
});
