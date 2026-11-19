import type { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import type { Locale } from '@/i18n/routing';

type Props = { locale: Locale; children: ReactNode };

export async function SiteShell({ locale, children }: Props) {
  return (
    <>
      <Header locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} />
    </>
  );
}
