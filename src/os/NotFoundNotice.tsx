import Link from 'next/link';

/**
 * The 404 message as a small static window (Spanish: the site-wide fallback
 * is served for every unmatched URL and the default locale is Spanish).
 * Plain markup with no shell state, so it also works as a whole document
 * (global-not-found.tsx) without the OS around it.
 */
export function NotFoundNotice() {
  return (
    <section aria-labelledby="not-found-title" className="os-notice">
      <div className="os-titlebar">
        <span className="os-title">404</span>
      </div>
      <div className="os-notice-body">
        <h1 id="not-found-title" className="os-heading">
          Página no encontrada
        </h1>
        <p>La página que buscas no existe o ha cambiado de dirección.</p>
        <p>
          <Link href="/" className="os-button">
            Volver al inicio
          </Link>
        </p>
      </div>
    </section>
  );
}
