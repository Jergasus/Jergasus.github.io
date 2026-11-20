'use client';

import { createContext, useContext, type Dispatch, type ReactNode } from 'react';
import type { Locale } from '@/i18n/routing';
import type { AppId, CaseAppId } from './apps';
import type { WmAction, WmState } from './window-manager';

/** desktop and phone come from html[data-os]; document is the server render and no-JS. */
export type OsMode = 'desktop' | 'phone' | 'document';

export interface OsApi {
  state: WmState;
  dispatch: Dispatch<WmAction>;
  /** For behaviour only: the markup never depends on it. */
  mode: OsMode;
  locale: Locale;
  /** The project the URL routes to (the page renders its window). */
  routedSlug: CaseAppId | null;
  openApp: (id: AppId, opener?: HTMLElement) => void;
  closeApp: (id: AppId) => void;
  focusApp: (id: AppId) => void;
  registerCase: (slug: CaseAppId, node: ReactNode) => void;
}

/** What the shell's own parts (window frames, the case host) need besides the public API. */
export interface OsInternal extends OsApi {
  cases: Partial<Record<CaseAppId, ReactNode>>;
  dropCase: (slug: CaseAppId) => void;
  minimizeApp: (id: AppId) => void;
}

export const OsContext = createContext<OsInternal | null>(null);

export function useOsInternal(): OsInternal {
  const os = useContext(OsContext);
  if (!os) throw new Error('JG-OS components must render inside <OsRoot>');
  return os;
}

export function useOs(): OsApi {
  return useOsInternal();
}

/**
 * True inside the window the page routes to (its project title is the page's
 * h1), false inside a window CaseHost keeps alive (an h2).
 */
export const CaseRoutedContext = createContext(true);
