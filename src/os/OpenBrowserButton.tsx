'use client';

import { useOs } from './context';

/**
 * A button that opens the retro browser and loads `url`.
 * Rendered by the server-side CaseApp to avoid passing extra namespaces to the client.
 */
export function OpenBrowserButton({ url, label }: { url: string; label: string }) {
  const { openBrowser } = useOs();
  return (
    <button type="button" className="os-button" onClick={() => openBrowser(url)}>
      {label}
    </button>
  );
}
