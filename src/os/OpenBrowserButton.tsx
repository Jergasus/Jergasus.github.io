'use client';

import { useOs } from './context';

/**
 * A button that opens the retro browser and loads `url`.
 * Rendered by the server-side CaseApp to avoid passing extra namespaces to the client.
 * It needs JavaScript, so the document (no JS, print) leaves it out (os-js-only).
 */
export function OpenBrowserButton({ url, label }: { url: string; label: string }) {
  const { openBrowser } = useOs();
  return (
    <button type="button" className="os-button os-js-only" onClick={() => openBrowser(url)}>
      {label}
    </button>
  );
}
