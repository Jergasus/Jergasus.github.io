import Link from 'next/link';
import { JgOsLogo } from './icons/JgOsLogo';
import { MissingFileIcon } from './icons/MissingFileIcon';

/**
 * The 404 message as a JG-OS error dialog (Spanish: the site-wide fallback
 * is served for every unmatched URL and the default locale is Spanish).
 * Plain markup with no shell state, so it also works as a whole document
 * (global-not-found.tsx) without the OS around it: the desk behind it is the
 * document's own background, and the artwork is inline SVG, so the page
 * needs nothing but its CSS and the self-hosted fonts.
 */
export function NotFoundNotice() {
  return (
    <section aria-labelledby="not-found-title" className="os-notice">
      <div className="os-titlebar">
        <span className="os-title-icon" aria-hidden="true">
          <JgOsLogo size={20} />
        </span>
        <span className="os-title">Error 404</span>
      </div>
      <div className="os-notice-body">
        <MissingFileIcon size={56} />
        <div className="os-notice-text">
          <h1 id="not-found-title" className="os-heading">
            No se encuentra el archivo
          </h1>
          <p>
            La página que buscas no existe o ha cambiado de dirección. Comprueba el enlace o vuelve
            al inicio.
          </p>
        </div>
        <p className="os-notice-actions">
          <Link href="/" className="os-button">
            Volver al inicio
          </Link>
        </p>
      </div>
    </section>
  );
}
