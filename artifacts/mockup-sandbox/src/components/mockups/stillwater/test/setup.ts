import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';

// jsdom has no native dialog/scroll UI. These shims test component state only,
// not Safari focus trapping, layout, or VoiceOver.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
HTMLElement.prototype.scrollIntoView = vi.fn();

let externalAttempts: string[];
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  externalAttempts = [];
  const rejectExternal = (kind: string) => (..._args: unknown[]): never => {
    externalAttempts.push(kind);
    throw new Error(`External operation forbidden in local companion tests: ${kind}`);
  };
  vi.stubGlobal('fetch', vi.fn(rejectExternal('fetch')));
  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(rejectExternal('XMLHttpRequest'));
  vi.stubGlobal('WebSocket', vi.fn(rejectExternal('WebSocket')));
  vi.stubGlobal('EventSource', vi.fn(rejectExternal('EventSource')));
  vi.spyOn(window, 'open').mockImplementation(rejectExternal('window.open'));
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), {
    sendBeacon: vi.fn(rejectExternal('sendBeacon')),
  }));
  // Reject external/tel links before jsdom can attempt navigation.
  document.addEventListener('click', blockNavigation, true);
});

function blockNavigation(event: MouseEvent) {
  const anchor = (event.target as Element).closest?.('a[href]');
  if (anchor) {
    event.preventDefault();
    externalAttempts.push(`link: ${anchor.getAttribute('href')}`);
  }
}

afterEach(() => {
  cleanup();
  document.removeEventListener('click', blockNavigation, true);
  const attempts = [...externalAttempts];
  vi.clearAllTimers();
  vi.useRealTimers();
  expect(attempts, 'No lookup, external navigation, or phone call is allowed').toEqual([]);
});
