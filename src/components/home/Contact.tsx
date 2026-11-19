import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import { contact, mailtoHref, whatsappHref } from '@/content/contact';
import { Reveal } from '@/components/motion/Reveal';

type Props = { locale: Locale };

export async function Contact({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'contact' });

  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      data-contact
      className="border-t border-rule px-gutter py-2xl lg:py-3xl"
    >
      <Reveal className="mx-auto max-w-page">
        {/* "Big closing CTA": heading IS the action. step-5 for extra weight. */}
        <h2
          id="contact-heading"
          data-contact-heading
          data-reveal-heading
          className="font-display text-step-5 uppercase"
        >
          {t('heading')}
        </h2>

        {/* Primary contact methods */}
        <div data-reveal-item className="mt-l border-t border-rule">
          <a
            href={mailtoHref()}
            className="block border-b border-rule py-m break-all font-display text-step-2 text-ink hover:text-accent active:text-accent"
          >
            {contact.email}
          </a>

          <a
            href={whatsappHref(t('whatsappMessage'))}
            rel="noopener noreferrer"
            target="_blank"
            aria-label={t('whatsappAriaLabel', { number: contact.whatsappDisplay })}
            className="block border-b border-rule py-m font-display text-step-2 text-ink hover:text-accent active:text-accent"
          >
            {contact.whatsappDisplay}
          </a>
        </div>

        {/* Secondary links */}
        <div data-reveal-item className="mt-m flex gap-l">
          <a
            href={contact.linkedin}
            rel="noopener noreferrer"
            target="_blank"
            className="font-mono text-step-0 text-ink-muted hover:text-ink active:text-ink"
          >
            LinkedIn
          </a>
          <a
            href={contact.github}
            rel="noopener noreferrer"
            target="_blank"
            className="font-mono text-step-0 text-ink-muted hover:text-ink active:text-ink"
          >
            GitHub
          </a>
        </div>
      </Reveal>
    </section>
  );
}
