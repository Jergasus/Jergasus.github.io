import type { AbstractIntlMessages } from 'next-intl';

/**
 * The message namespaces client components may translate (useTranslations in
 * a 'use client' file). Everything else is rendered on the server, so the
 * root layouts hand NextIntlClientProvider just these, instead of every page
 * shipping all the copy of every page (all three case studies included) in
 * its RSC payload. A task that adds a client component reading another
 * namespace adds it here in the same commit; client-messages.test.ts fails
 * otherwise. Prefer server-rendered children over new client namespaces.
 */
export const CLIENT_NAMESPACES = ['os', 'work'] as const;

export function clientMessages(messages: Record<string, unknown>): AbstractIntlMessages {
  return Object.fromEntries(
    CLIENT_NAMESPACES.map((namespace) => [namespace, messages[namespace]]),
  ) as AbstractIntlMessages;
}
