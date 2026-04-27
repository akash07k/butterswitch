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
  let focused: EventDefinition;
  let unfocused: EventDefinition;

  beforeEach(() => {
    vi.useFakeTimers();
    events = createWindowFocusEvents();
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
    const otherEvents = createWindowFocusEvents();
    const [, otherUnfocused] = otherEvents;

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
});
