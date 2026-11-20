import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';

/**
 * The home page's one h1: hidden on the desktop and the phone (the windows
 * say who he is), the document's title without JavaScript and in print.
 */
export async function HomeTitle({ locale }: { locale: Locale }) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return <h1 className="os-doc-title">{t('title')}</h1>;
}
