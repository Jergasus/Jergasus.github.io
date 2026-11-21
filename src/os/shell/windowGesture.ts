'use client';

/**
 * A window drag or resize must never select text. A real mouse press starts a
 * text selection, and Safari then extends it across the page as the window
 * moves. For the length of the gesture `html[data-os-gesture]` switches text
 * selection off everywhere (see os.css), and any selection already on the page
 * is dropped.
 */
export function beginWindowGesture(): void {
  document.documentElement.setAttribute('data-os-gesture', '');
  window.getSelection()?.removeAllRanges();
  // Safety net: however the gesture ends (a release anywhere, or the browser
  // window losing focus mid-drag), selection always comes back.
  window.addEventListener('pointerup', endWindowGesture, { once: true });
  window.addEventListener('blur', endWindowGesture, { once: true });
}

/** Gives text selection back once the drag or resize ends. */
export function endWindowGesture(): void {
  document.documentElement.removeAttribute('data-os-gesture');
  window.removeEventListener('pointerup', endWindowGesture);
  window.removeEventListener('blur', endWindowGesture);
}
