import { describe, it, expect, vi, beforeEach } from "vitest";
import { InMemorySettingsStore } from "../store.js";

describe("InMemorySettingsStore", () => {
  let store: InMemorySettingsStore;

  beforeEach(() => {
    store = new InMemorySettingsStore();
  });

  it("returns undefined for unset keys", async () => {
    const value = await store.get("nonexistent");
    expect(value).toBeUndefined();
  });

  it("stores and retrieves values", async () => {
    await store.set("general.masterVolume", 80);
    const value = await store.get<number>("general.masterVolume");

    expect(value).toBe(80);
  });

  it("overwrites existing values", async () => {
    await store.set("key", "first");
    await store.set("key", "second");

    expect(await store.get("key")).toBe("second");
  });

  it("supports initial values in constructor", async () => {
    const store = new InMemorySettingsStore({
      "general.muted": false,
      "general.masterVolume": 75,
    });

    expect(await store.get("general.muted")).toBe(false);
    expect(await store.get("general.masterVolume")).toBe(75);
  });

  it("notifies watchers when a value changes", async () => {
    const handler = vi.fn();
    store.watch("general.volume", handler);

    await store.set("general.volume", 50);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(50);
  });

  it("does not notify watchers for other keys", async () => {
    const handler = vi.fn();
    store.watch("general.volume", handler);

    await store.set("general.muted", true);

    expect(handler).not.toHaveBeenCalled();
  });

  it("returns an unwatch function", async () => {
    const handler = vi.fn();
    const unwatch = store.watch("key", handler);

    await store.set("key", "first");
    unwatch();
    await store.set("key", "second");

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports multiple watchers on the same key", async () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    store.watch("key", handlerA);
    store.watch("key", handlerB);

    await store.set("key", "value");

    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).toHaveBeenCalledOnce();
  });

  it("isolates watcher errors — a throwing handler does not block other handlers on the same key", async () => {
    // Regression guard: before this was fixed, a throw inside a
    // watcher would propagate out of set() and stop subsequent
    // watchers from firing. Now handler errors are caught and the
    // rest of the list still receives the notification.
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const throwingHandler = vi.fn(() => {
      throw new Error("boom");
    });
    const goodHandler = vi.fn();

    store.watch("key", throwingHandler);
    store.watch("key", goodHandler);

    await store.set("key", "value");

    expect(throwingHandler).toHaveBeenCalledOnce();
    expect(goodHandler).toHaveBeenCalledOnce();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Watcher error on key "key"'),
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("snapshots the watcher list — a watcher added during notification does not fire for the current set()", async () => {
    // Regression guard: without the snapshot, Set iteration-with-add
    // would cause the newly-registered watcher to fire for the same
    // set() call that triggered it. The invariant is "a watcher fires
    // only for changes AFTER it was registered."
    const lateHandler = vi.fn();
    const earlyHandler = vi.fn(() => {
      store.watch("key", lateHandler);
    });

    store.watch("key", earlyHandler);
    await store.set("key", "first");

    expect(earlyHandler).toHaveBeenCalledOnce();
    expect(lateHandler).not.toHaveBeenCalled();

    // But the late handler is alive and fires on the next change.
    await store.set("key", "second");
    expect(lateHandler).toHaveBeenCalledOnce();
    expect(lateHandler).toHaveBeenCalledWith("second");
  });
});
