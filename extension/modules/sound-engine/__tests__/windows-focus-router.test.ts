import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createWindowFocusEvents, WINDOW_SWITCH_DEBOUNCE_MS } from "../windows-focus-router.js";
import type { EventDefinition } from "../types.js";

const WINDOW_ID_NONE = -1;

/**
 * Shorthand for invoking an event's `handler` and getting its return
 * value. The factory always sets `handler`, so we narrow the type here
 * once instead of at each call site.
 */
async function invoke(
  event: EventDefinition,
  windowId: number,
): Promise<{ suppress?: boolean } | undefined> {
  if (!event.handler) {
    throw new Error(`expected handler on ${event.id}`);
  }
  const result = await event.handler(windowId);
  return result ?? undefined;
}

describe("createWindowFocusEvents", () => {
  let events: EventDefinition[];
  let dispose: () => void;
  let focused: EventDefinition;
  let unfocused: EventDefinition;

  beforeEach(() => {
    vi.useFakeTimers();
    const built = createWindowFocusEvents();
    events = built.events;
    dispose = built.dispose;
    [focused, unfocused] = events;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns two events with the expected ids and labels", () => {
    expect(events).toHaveLength(2);
    expect(focused.id).toBe("windows.onFocused");
    expect(focused.label).toBe("Window Focused");
    expect(unfocused.id).toBe("windows.onUnfocused");
    expect(unfocused.label).toBe("Window Unfocused");
  });

  it("returns a dispose function alongside the events", () => {
    expect(typeof dispose).toBe("function");
  });

  it("both events register against the same browser API", () => {
    expect(focused.namespace).toBe("windows");
    expect(focused.event).toBe("onFocusChanged");
    expect(unfocused.namespace).toBe("windows");
    expect(unfocused.event).toBe("onFocusChanged");
  });

  it("focused fires for a valid windowId", async () => {
    const result = await invoke(focused, 42);
    expect(result?.suppress).toBeUndefined();
  });

  it("focused suppresses on WINDOW_ID_NONE", async () => {
    const result = await invoke(focused, WINDOW_ID_NONE);
    expect(result?.suppress).toBe(true);
  });

  it("unfocused fires after the debounce window when no follow-up arrives", async () => {
    const promise = invoke(unfocused, WINDOW_ID_NONE);
    await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
    const result = await promise;
    expect(result?.suppress).toBeUndefined();
  });

  it("unfocused suppresses for a valid windowId", async () => {
    const result = await invoke(unfocused, 42);
    expect(result?.suppress).toBe(true);
  });

  it("focused arriving within debounce cancels a pending unfocused (window switch)", async () => {
    // The Linux/Windows sequence: WINDOW_ID_NONE then a real id.
    const unfocusedPromise = invoke(unfocused, WINDOW_ID_NONE);
    // Advance partway, not past the debounce.
    await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS - 50);

    // Now the real focus arrives — should cancel the pending unfocused.
    const focusedResult = await invoke(focused, 7);
    expect(focusedResult?.suppress).toBeUndefined();

    // Drain any remaining timer to settle the unfocused promise.
    await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
    const unfocusedResult = await unfocusedPromise;
    expect(unfocusedResult?.suppress).toBe(true);
  });

  it("focused with no pending unfocused is a clean no-op success", async () => {
    const result = await invoke(focused, 1);
    expect(result?.suppress).toBeUndefined();
    const second = await invoke(focused, 2);
    expect(second?.suppress).toBeUndefined();
  });

  it("a fresh WINDOW_ID_NONE replaces an earlier pending unfocused", async () => {
    const first = invoke(unfocused, WINDOW_ID_NONE);
    // Mid-debounce, a second NONE arrives — the first should be cancelled.
    await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS - 30);
    const second = invoke(unfocused, WINDOW_ID_NONE);

    // The first promise resolves with suppress=true (cancelled).
    await vi.advanceTimersByTimeAsync(0);
    const firstResult = await first;
    expect(firstResult?.suppress).toBe(true);

    // The second waits the full debounce window from its own start.
    await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
    const secondResult = await second;
    expect(secondResult?.suppress).toBeUndefined();
  });

  it("two factory calls have independent state", async () => {
    const other = createWindowFocusEvents();
    const [, otherUnfocused] = other.events;

    // Start a pending unfocused on the first instance.
    const firstPending = invoke(unfocused, WINDOW_ID_NONE);

    // Cancel it via the first instance's focused — the second
    // instance should not be affected.
    await invoke(focused, 1);
    await vi.advanceTimersByTimeAsync(0);
    const firstResult = await firstPending;
    expect(firstResult?.suppress).toBe(true);

    // The second instance's unfocused still works.
    const secondPending = invoke(otherUnfocused, WINDOW_ID_NONE);
    await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
    const secondResult = await secondPending;
    expect(secondResult?.suppress).toBeUndefined();
  });

  it("dispose cancels a pending unfocus and resolves it as suppressed", async () => {
    // Arm the debounce: WINDOW_ID_NONE puts an unfocus in flight.
    const pending = invoke(unfocused, WINDOW_ID_NONE);

    // Tear down before the timer fires.
    dispose();

    // The awaiting promise settles cleanly via the cancellation path
    // (resolver invoked with shouldEmit=false → handler returns
    // { suppress: true }).
    const result = await pending;
    expect(result?.suppress).toBe(true);

    // Advancing past the original debounce must not produce a late
    // emission — the timer is gone, the resolver is gone.
    await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS * 2);
    expect(result?.suppress).toBe(true);
  });

  it("dispose with no pending unfocus is a no-op", () => {
    expect(() => dispose()).not.toThrow();
  });

  describe("onFocusStateChange", () => {
    it("notifies false after the unfocus debounce settles", async () => {
      const cb = vi.fn();
      const built = createWindowFocusEvents();
      built.onFocusStateChange(cb);

      const pending = invoke(built.events[1]!, WINDOW_ID_NONE);
      await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
      const result = await pending;

      expect(result?.suppress).toBeUndefined();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(false);

      built.dispose();
    });

    it("notifies true on focus regain after a real unfocus", async () => {
      const cb = vi.fn();
      const built = createWindowFocusEvents();
      built.onFocusStateChange(cb);

      // Drive a real unfocus first (debounce settles) so the next
      // focused() call is an actual edge.
      const pending = invoke(built.events[1]!, WINDOW_ID_NONE);
      await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
      await pending;
      cb.mockClear();

      const focusedResult = await invoke(built.events[0]!, 7);
      expect(focusedResult?.suppress).toBeUndefined();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(true);

      built.dispose();
    });

    it("does not fire false on a within-debounce window switch", async () => {
      const cb = vi.fn();
      const built = createWindowFocusEvents();
      built.onFocusStateChange(cb);

      // The Linux/Windows window-switch quirk: NONE then a real id
      // before the debounce elapses.
      const unfocusedPromise = invoke(built.events[1]!, WINDOW_ID_NONE);
      await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS - 50);
      await invoke(built.events[0]!, 9);
      // Drain the cancelled timer's queued resolution.
      await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
      const unfocusedResult = await unfocusedPromise;
      expect(unfocusedResult?.suppress).toBe(true);

      // Initial state was focused, the focused() call was a no-op
      // edge (already focused), and no unfocus settled — the
      // subscriber must not have been called at all.
      expect(cb).not.toHaveBeenCalled();

      built.dispose();
    });

    it("only fires on actual transitions (no duplicates for same state)", async () => {
      const cb = vi.fn();
      const built = createWindowFocusEvents();
      built.onFocusStateChange(cb);

      // Two focused() calls in a row while already focused — must not
      // fire `true` since there is no transition.
      await invoke(built.events[0]!, 1);
      await invoke(built.events[0]!, 2);
      expect(cb).not.toHaveBeenCalled();

      built.dispose();
    });

    it("unsubscribing prevents further callbacks", async () => {
      const cb = vi.fn();
      const built = createWindowFocusEvents();
      const unsubscribe = built.onFocusStateChange(cb);
      unsubscribe();

      const pending = invoke(built.events[1]!, WINDOW_ID_NONE);
      await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
      await pending;

      expect(cb).not.toHaveBeenCalled();

      built.dispose();
    });

    it("dispose clears subscribers so they receive no further notifications", async () => {
      const cb = vi.fn();
      const built = createWindowFocusEvents();
      built.onFocusStateChange(cb);

      built.dispose();

      // After dispose, internal state was reset to focused and the
      // subscriber set was cleared. Drive an unfocus through to
      // settled — would normally fire `false`, but must not now.
      const pending = invoke(built.events[1]!, WINDOW_ID_NONE);
      await vi.advanceTimersByTimeAsync(WINDOW_SWITCH_DEBOUNCE_MS);
      await pending;

      expect(cb).not.toHaveBeenCalled();
    });

    it("returns the unsubscribe handle as a function", () => {
      const built = createWindowFocusEvents();
      const unsubscribe = built.onFocusStateChange(() => {});
      expect(typeof unsubscribe).toBe("function");
      built.dispose();
    });
  });
});
