/**
 * @module settings/browser-store
 *
 * Settings store backed by browser.storage.local.
 *
 * This is the production settings store — reads and writes go to
 * the browser's extension storage, which persists across restarts
 * and syncs between the background script and UI pages (popup, options).
 *
 * Falls back to provided default values when a key hasn't been
 * set yet (fresh install).
 */

import type { SettingsStore } from "../module-system/types.js";

/** Type for a watch callback function. */
type WatchHandler = (newValue: unknown) => void;

/**
 * Settings store backed by browser.storage.local.
 *
 * Implements the SettingsStore interface used by modules via ModuleContext.
 * Uses browser.storage.local for persistence (cross-browser via WXT).
 *
 * @example
 * ```ts
 * const store = new BrowserSettingsStore({ "general.masterVolume": 80 });
 * const volume = await store.get<number>("general.masterVolume"); // 80 (default)
 * await store.set("general.masterVolume", 50); // saved to browser storage
 * ```
 */
export class BrowserSettingsStore implements SettingsStore {
  /** Default values used when a key hasn't been set in storage. */
  private readonly defaults: Record<string, unknown>;

  /** Watch handlers keyed by setting path. */
  private readonly watchers = new Map<string, Set<WatchHandler>>();

  /** Bound handler for storage.onChanged — stored as field for removeListener. */
  private readonly onStorageChanged: (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ) => void;

  /** @param defaults - Default values for all settings (used on fresh install). */
  constructor(defaults: Record<string, unknown>) {
    this.defaults = defaults;

    // Listen for storage changes to notify watchers.
    //
    // Iteration invariants match InMemorySettingsStore.set and
    // MessageBusImpl.publish: snapshot to isolate against
    // mid-iteration watcher registration, and catch/log per-handler
    // so one buggy subscriber cannot break remaining subscribers.
    this.onStorageChanged = (changes, areaName) => {
      if (areaName !== "local") return;

      for (const [key, change] of Object.entries(changes)) {
        const handlers = this.watchers.get(key);
        if (handlers) {
          const snapshot = [...handlers];
          for (const handler of snapshot) {
            try {
              handler(change.newValue);
            } catch (error) {
              console.error(`[SettingsStore] Watcher error on key "${key}":`, error);
            }
          }
        }
      }
    };

    browser.storage.onChanged.addListener(this.onStorageChanged);
  }

  /** Remove the storage change listener to prevent memory leaks. */
  dispose(): void {
    browser.storage.onChanged.removeListener(this.onStorageChanged);
    this.watchers.clear();
  }

  /**
   * Get a setting value by key.
   * Returns the stored value, or the default if not yet set.
   */
  async get<T>(key: string): Promise<T | undefined> {
    const result = await browser.storage.local.get(key);
    if (result[key] !== undefined) {
      return result[key] as T;
    }
    return this.defaults[key] as T | undefined;
  }

  /**
   * Set a setting value. Persists to browser.storage.local.
   * Watchers are notified via the storage.onChanged listener.
   */
  async set<T>(key: string, value: T): Promise<void> {
    await browser.storage.local.set({ [key]: value });
  }

  /**
   * Watch for changes to a setting.
   * The handler fires when the value changes in storage
   * (from any context — popup, options, or background).
   *
   * @returns An unwatch function.
   */
  watch(key: string, handler: WatchHandler): () => void {
    if (!this.watchers.has(key)) {
      this.watchers.set(key, new Set());
    }

    const handlers = this.watchers.get(key)!;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }
}
