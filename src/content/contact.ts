export const contact = {
  email: 'jergasus04@gmail.com',
  whatsappNumber: '34633732440',
  whatsappDisplay: '+34 633 732 440',
  linkedin: 'https://www.linkedin.com/in/jes%C3%BAs-jos%C3%A9-garc%C3%ADa-ayala-716294331/',
  github: 'https://github.com/Jergasus',
} as const;

export function whatsappHref(message: string): string {
  return `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export function mailtoHref(subject?: string, body?: string): string {
  if (subject === undefined) {
    return `mailto:${contact.email}`;
  }
  if (body === undefined) {
    return `mailto:${contact.email}?subject=${encodeURIComponent(subject)}`;
  }
  return `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
