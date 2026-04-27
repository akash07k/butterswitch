/**
 * @module sound-engine/windows-focus-router
 *
 * Splits the single `windows.onFocusChanged` browser event into two
 * registry-visible events that can carry distinct sounds:
 *
 *   - `windows.onFocused`   — a browser window received focus.
 *   - `windows.onUnfocused` — all browser windows lost focus
 *                             (the user switched to another application).
 *
 * Both entries register against the same underlying browser API
 * (`browser.windows.onFocusChanged`); the engine delivers every
 * fired event to both handlers, and each handler decides whether
 * its own event id should emit, based on the `windowId` argument.
 *
 * The `WINDOW_ID_NONE` quirk
 * --------------------------
 * Chrome and MDN both document that on Windows and some Linux
 * window managers, `WINDOW_ID_NONE` (`-1`) is dispatched immediately
 * before a switch from one browser window to another, even though
 * the user never gave focus to a non-browser application. Firing
 * the unfocused sound on every cross-window switch would be wrong
 * and noisy.
 *
 * The fix is a short debounce: when WINDOW_ID_NONE arrives, hold
 * the unfocused emission for `WINDOW_SWITCH_DEBOUNCE_MS`. If a real
 * windowId arrives before the timer elapses, that's a window switch
 * — suppress the unfocused emission. If the timer elapses with no
 * follow-up, the user really left the browser.
 *
 * The factory exposes the closure so the cross-handler state
 * (`pendingUnfocusResolver`, `pendingUnfocusTimer`) does not leak
 * into module scope. Tests can rebuild a fresh pair per test by
 * calling the factory again.
 */

import type { EventDefinition } from "./types.js";

const WINDOW_ID_NONE = -1;

/**
 * How long we wait after a WINDOW_ID_NONE arrives before emitting
 * `windows.onUnfocused`. If a valid windowId arrives within this
 * window, the unfocused emission is cancelled and only
 * `windows.onFocused` fires.
 *
 * 150 ms is comfortably above the gap browsers leave between the
 * synthetic NONE and the real focus event during a window switch
 * (typically 5–50 ms on the affected platforms) but well below any
 * audible delay a user would notice when intentionally leaving the
 * browser.
 */
export const WINDOW_SWITCH_DEBOUNCE_MS = 150;

/**
 * Build the paired `windows.onFocused` / `windows.onUnfocused`
 * event definitions with a shared debounce that handles the
 * WINDOW_ID_NONE quirk on Windows and some Linux window managers.
 *
 * Calling the factory again returns a fresh pair with its own
 * closure state, which is what tests need to stay independent.
 */
export function createWindowFocusEvents(): EventDefinition[] {
  let pendingUnfocusResolver: ((shouldEmit: boolean) => void) | null = null;
  let pendingUnfocusTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Detach and return the currently-pending unfocus resolver, if any.
   * Clears the associated timer so it cannot fire after the caller
   * decides what to do with the resolver.
   */
  function takePendingResolver(): ((shouldEmit: boolean) => void) | null {
    const resolver = pendingUnfocusResolver;
    if (pendingUnfocusTimer !== null) {
      clearTimeout(pendingUnfocusTimer);
      pendingUnfocusTimer = null;
    }
    pendingUnfocusResolver = null;
    return resolver;
  }

  return [
    {
      id: "windows.onFocused",
      namespace: "windows",
      event: "onFocusChanged",
      label: "Window Focused",
      description: "A browser window received focus.",
      tier: 1,
      category: "windows",
      platforms: ["chrome", "firefox"],
      permissions: [],
      extractData: (windowId: unknown) => ({ windowId }),
      handler: async (windowId: unknown) => {
        if (typeof windowId !== "number" || windowId === WINDOW_ID_NONE) {
          return { suppress: true };
        }
        // A valid window gained focus. If a previous WINDOW_ID_NONE
        // is still in its debounce window, this proves the NONE was
        // a window-switch transient — cancel the pending unfocused
        // emission.
        const resolver = takePendingResolver();
        if (resolver) {
          resolver(false);
        }
        return {};
      },
    },
    {
      id: "windows.onUnfocused",
      namespace: "windows",
      event: "onFocusChanged",
      label: "Window Unfocused",
      description: "All browser windows lost focus (you switched to another application).",
      tier: 1,
      category: "windows",
      platforms: ["chrome", "firefox"],
      permissions: [],
      extractData: (windowId: unknown) => ({ windowId }),
      handler: async (windowId: unknown) => {
        if (typeof windowId !== "number" || windowId !== WINDOW_ID_NONE) {
          return { suppress: true };
        }
        // A fresh WINDOW_ID_NONE replaces any earlier pending
        // unfocus — restart the debounce window.
        const previous = takePendingResolver();
        if (previous) {
          previous(false);
        }
        const shouldEmit = await new Promise<boolean>((resolve) => {
          pendingUnfocusResolver = resolve;
          pendingUnfocusTimer = setTimeout(() => {
            const r = pendingUnfocusResolver;
            pendingUnfocusResolver = null;
            pendingUnfocusTimer = null;
            r?.(true);
          }, WINDOW_SWITCH_DEBOUNCE_MS);
        });
        return shouldEmit ? {} : { suppress: true };
      },
    },
  ];
}
