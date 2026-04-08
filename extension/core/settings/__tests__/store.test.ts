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
});
