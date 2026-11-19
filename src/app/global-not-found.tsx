/**
 * Global 404 page → out/404.html (served by GitHub Pages for any unmatched
 * URL). The app has two root layouts, (es) and [locale], so there is no single
 * layout to wrap a root not-found.tsx; Next.js wrapped it in a default
 * <html><body> instead, nesting two documents. global-not-found.tsx
 * (experimental.globalNotFound in next.config.ts) skips layouts entirely and
 * renders this as the whole document.
 * Spanish only: it is the site-wide fallback and the default locale is Spanish.
 *
 * globals.css is imported here so Tailwind token utilities resolve at render
 * time. Inline styles are avoided; every value comes from a token utility.
 */
import type { Metadata } from 'next';
import { displayFont, textFont, monoFont } from '@/design/fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Página no encontrada · Jesús García',
  description: 'La página que buscas no existe. Vuelve al inicio.',
};

export default function GlobalNotFound() {
  return (
    <html
      lang="es"
      className={`${displayFont.variable} ${textFont.variable} ${monoFont.variable}`}
    >
      <body>
        <main className="px-gutter py-3xl min-h-[60vh] flex flex-col justify-center">
          <div className="max-w-[var(--container-page)] mx-auto">
            <p className="font-mono text-step--1 text-ink-muted mb-s">404</p>
            <h1 className="font-display text-step-5 leading-display uppercase mb-m">
              Página no encontrada
            </h1>
            <p className="text-step-1 text-ink-muted mb-xl max-w-[52ch]">
              La página que buscas no existe o ha cambiado de dirección.
            </p>
            <a
              href="/"
              className="font-mono text-step-0 text-accent underline underline-offset-4"
            >
              Volver al inicio
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
