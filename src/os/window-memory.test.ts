import { expect, test } from 'vitest';
import { forgetWindow, recallWindow, rememberWindow, windowReopened } from './window-memory';

test('a moved window gets its scroll and focus back once', () => {
  rememberWindow('questday', { scroll: 120, focus: 2 });
  expect(recallWindow('questday')).toEqual({ scroll: 120, focus: 2 });
  expect(recallWindow('questday')).toBeUndefined();
});

test('a closed window starts fresh', () => {
  rememberWindow('sakurai', { scroll: 80, focus: null });
  forgetWindow('sakurai');
  // The unmount that follows the close is not remembered.
  rememberWindow('sakurai', { scroll: 300, focus: 0 });
  expect(recallWindow('sakurai')).toBeUndefined();
  // Later moves are remembered again.
  rememberWindow('sakurai', { scroll: 40, focus: -1 });
  expect(recallWindow('sakurai')).toEqual({ scroll: 40, focus: -1 });
});

test('a window reopened before it unmounted keeps remembering its moves', () => {
  forgetWindow('rally-voley');
  windowReopened('rally-voley');
  rememberWindow('rally-voley', { scroll: 10, focus: null });
  expect(recallWindow('rally-voley')).toEqual({ scroll: 10, focus: null });
});
