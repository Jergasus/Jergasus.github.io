import type { AbstractIntlMessages } from 'next-intl';

/**
 * The message namespaces client components translate (useTranslations in a
 * 'use client' file): today only the hero's data strip. Everything else is
 * rendered on the server, so the root layouts hand NextIntlClientProvider
 * just these, instead of every page shipping all the copy of every page
 * (all three case studies included) in its RSC payload.
 * client-messages.test.ts fails when a client component reads another one.
 */
export const CLIENT_NAMESPACES = ['hero'] as const;

export function clientMessages(messages: Record<string, unknown>): AbstractIntlMessages {
  return Object.fromEntries(
    CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]),
  ) as AbstractIntlMessages;
}
