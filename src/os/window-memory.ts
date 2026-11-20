import type { AppId } from './apps';

/**
 * What a window's DOM holds that its state does not: the body's scroll
 * position and which control has focus.
 *
 * A project window moves between two places as the URL changes (the page
 * renders the routed one; CaseHost renders the others), and React remounts
 * it on every move. WindowFrame remembers these two things as it unmounts
 * and gives them back as it mounts again, so bringing a project forward
 * never scrolls it to the top or drops keyboard focus.
 */
export type WindowMemory = {
  scroll: number;
  /** Index of the focused element among the window's focusables, -1 for the window itself, null for none. */
  focus: number | null;
};

const memories = new Map<AppId, WindowMemory>();
const closing = new Set<AppId>();

/** A window was closed: whatever it held is not wanted when it opens again. */
export function forgetWindow(id: AppId): void {
  memories.delete(id);
  closing.add(id);
}

/** The window is open again: a later unmount is a move, not a close. */
export function windowReopened(id: AppId): void {
  closing.delete(id);
}

/** Called as a window unmounts; ignored when it unmounts because it closed. */
export function rememberWindow(id: AppId, memory: WindowMemory): void {
  if (closing.delete(id)) return;
  memories.set(id, memory);
}

/** Called as a window mounts: what it held before its last move, once. */
export function recallWindow(id: AppId): WindowMemory | undefined {
  const memory = memories.get(id);
  memories.delete(id);
  return memory;
}
