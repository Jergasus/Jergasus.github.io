import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/site/LanguageSwitcher';
import type { Locale } from '@/i18n/routing';

/**
 * Placeholder taskbar: only the language switch, until the real taskbar
 * (start menu, tasks, tray) replaces it.
 */
export async function TaskbarStub({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'switcher' });
  return (
    <div data-taskbar className="os-taskbar">
      <LanguageSwitcher currentLocale={locale} label={t('label')} />
    </div>
  );
}
