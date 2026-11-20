import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';
import type { WindowLabels } from './WindowFrame';

/** The title-bar button names, translated on the server and handed to every WindowFrame. */
export async function windowLabels(locale: Locale): Promise<WindowLabels> {
  const t = await getTranslations({ locale, namespace: 'os.window' });
  return { close: t('close'), minimize: t('minimize'), maximize: t('maximize'), restore: t('restore') };
}
