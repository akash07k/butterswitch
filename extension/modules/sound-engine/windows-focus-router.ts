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
 * Pair of event definitions and a `dispose()` that cancels any
 * in-flight debounce timer. Returned by {@link createWindowFocusEvents}.
 *
 * `dispose()` exists because `WINDOW_FOCUS_EVENTS` is built once at
 * module load. Without it, a `setTimeout` armed by the unfocused
 * handler would survive the sound engine's own `dispose()` and fire
 * later, resolving a stale promise and publishing into a torn-down
 * message bus.
 */
export interface WindowFocusEvents {
  events: EventDefinition[];
  /**
   * Cancel any pending unfocus timer and resolve its promise with
   * `false` (so the awaiting handler's promise settles cleanly with
   * `{ suppress: true }` instead of leaking). Also clears any
   * focus-state subscribers and resets the tracked state to focused.
   */
  dispose: () => void;
  /**
   * Subscribe to focus-state transitions. The callback fires with
   * `true` when a browser window regains focus and `false` after the
   * unfocus debounce settles into a real "user left the browser"
   * (i.e., not a within-debounce window switch). Initial state is
   * assumed to be focused, so callbacks fire only on actual transitions
   * — subscribing while already focused will not fire `true`
   * immediately.
   *
   * Returns an unsubscribe function. Subscribers are notified BEFORE
   * the corresponding sound event publishes, so a downstream listener
   * (e.g., a "mute when unfocused" gate in the sound engine) sees the
   * new state in time to suppress the cue itself.
   */
  onFocusStateChange(callback: (focused: boolean) => void): () => void;
}

/**
 * Static metadata for the paired window-focus events — id, label,
 * tier, etc. — without the live handler closure. The registry imports
 * these so it stays a pure-data module; the engine layers handlers
 * on top via {@link createWindowFocusEvents} during initialize().
 *
 * Both halves of the pair register against the same browser API
 * (`browser.windows.onFocusChanged`); the engine delivers every fired
 * event to both registered handlers, and each handler decides whether
 * its own event id should emit based on the `windowId` argument.
 */
export const WINDOW_FOCUS_EVENT_DEFINITIONS: EventDefinition[] = [
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
  },
];

/**
 * Build the paired `windows.onFocused` / `windows.onUnfocused`
 * event definitions with a shared debounce that handles the
 * WINDOW_ID_NONE quirk on Windows and some Linux window managers.
 *
 * Calling the factory again returns a fresh pair with its own
 * closure state, which is what tests need to stay independent.
 *
 * The returned `dispose()` cancels any pending unfocus timer so a
 * sound-engine teardown does not leave a stray `setTimeout` armed
 * to fire after the message bus is gone.
 */
export function createWindowFocusEvents(): WindowFocusEvents {
  let pendingUnfocusResolver: ((shouldEmit: boolean) => void) | null = null;
  let pendingUnfocusTimer: ReturnType<typeof setTimeout> | null = null;

  // Tracks whether a browser window currently has focus from the
  // perspective of subscribers. Initial value is `true` because the
  // service worker boots while the browser is open and (typically)
  // focused; the first transition we observe is the interesting one.
  let browserFocused = true;
  const focusStateSubscribers = new Set<(focused: boolean) => void>();

  /**
   * Update the tracked focus state and notify subscribers. Early-returns
   * on no-op transitions so subscribers only see actual edges (e.g., a
   * second `true` from a focus-already-focused stays silent).
   *
   * Each subscriber call is wrapped in try/catch so a throwing handler
   * cannot abort the rest of the notify chain.
   */
  function setFocusState(focused: boolean): void {
    if (browserFocused === focused) return;
    browserFocused = focused;
    for (const cb of [...focusStateSubscribers]) {
      try {
        cb(focused);
      } catch {
        // Subscriber errors must not break the others. Logging is the
        // caller's responsibility; this layer has no logger.
      }
    }
  }

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

  const [focusedDef, unfocusedDef] = WINDOW_FOCUS_EVENT_DEFINITIONS;

  const events: EventDefinition[] = [
    {
      ...focusedDef!,
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
        // Notify subscribers BEFORE the engine publishes the focused
        // sound event, so a downstream "mute when unfocused" gate has
        // the up-to-date state in time to let the cue through.
        setFocusState(true);
        return {};
      },
    },
    {
      ...unfocusedDef!,
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
        if (shouldEmit) {
          // Debounce settled — the user really left the browser.
          // Update subscribers BEFORE returning so the engine sees
          // the new state in time to suppress the unfocus cue itself
          // when the user has opted into mute-when-blurred.
          setFocusState(false);
          return {};
        }
        return { suppress: true };
      },
    },
  ];

  return {
    events,
    onFocusStateChange(callback) {
      focusStateSubscribers.add(callback);
      return () => {
        focusStateSubscribers.delete(callback);
      };
    },
    dispose() {
      const resolver = takePendingResolver();
      if (resolver) resolver(false);
      focusStateSubscribers.clear();
      browserFocused = true;
    },
  };
}
