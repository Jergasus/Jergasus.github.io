/**
 * Global 404 page → out/404.html (served by GitHub Pages for any unmatched
 * URL). The app has two root layouts, (es) and [locale], so there is no single
 * layout to wrap a root not-found.tsx; Next.js wrapped it in a default
 * <html><body> instead, nesting two documents. global-not-found.tsx
 * (experimental.globalNotFound in next.config.ts) skips layouts entirely and
 * renders this as the whole document.
 * Spanish only: it is the site-wide fallback and the default locale is Spanish.
 *
 * It has no pre-paint script, so it renders in the OS's document style.
 */
import type { Metadata } from 'next';
import { osFontVariables } from '@/design/fonts';
import { NotFoundNotice } from '@/os/NotFoundNotice';
import './globals.css';

export const metadata: Metadata = {
  title: 'Página no encontrada · Jesús García',
  description: 'La página que buscas no existe. Vuelve al inicio.',
};

export default function GlobalNotFound() {
  return (
    <html lang="es" className={osFontVariables}>
      <body>
        <main>
          <NotFoundNotice />
        </main>
      </body>
    </html>
  );
}
