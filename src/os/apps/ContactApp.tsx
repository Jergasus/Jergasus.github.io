import { getTranslations } from 'next-intl/server';
import { contact, mailtoHref, whatsappHref } from '@/content/contact';
import type { Locale } from '@/i18n/routing';

/** contacto: email and WhatsApp first, then LinkedIn and GitHub. */
export async function ContactApp({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <div className="os-contact">
      <h2 className="os-heading">{t('heading')}</h2>
      <p className="os-contact-main">
        <a href={mailtoHref()} className="os-contact-link">
          {contact.email}
        </a>
        <a
          href={whatsappHref(t('whatsappMessage'))}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('whatsappAriaLabel', { number: contact.whatsappDisplay })}
          className="os-contact-link"
        >
          {contact.whatsappDisplay}
        </a>
      </p>
      <p className="os-contact-more">
        <a href={contact.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
        <a href={contact.github} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </p>
    </div>
  );
}
