'use client';

import { useContext, type ReactNode } from 'react';
import { CaseRoutedContext } from './context';

/**
 * A project window's title: the page's one h1 in the routed window, an h2 in
 * a window kept open behind it (spec: exactly one h1 per page).
 */
export function CaseTitle({ className, children }: { className?: string; children: ReactNode }) {
  const routed = useContext(CaseRoutedContext);
  return routed ? <h1 className={className}>{children}</h1> : <h2 className={className}>{children}</h2>;
}
