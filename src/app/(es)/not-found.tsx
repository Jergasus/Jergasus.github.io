import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Página no encontrada · Jesús García',
  description: 'La página que buscas no existe. Vuelve al inicio.',
};

export default function NotFound() {
  return (
    <section className="px-gutter py-3xl min-h-[60vh] flex flex-col justify-center">
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
    </section>
  );
}
