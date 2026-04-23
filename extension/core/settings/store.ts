/**
 * @module settings/store
 *
 * In-memory settings store implementation.
 *
 * Provides an in-memory implementation of the SettingsStore interface
 * for use in tests and non-browser contexts. Production code uses
 * {@link BrowserSettingsStore} from `./browser-store`.
 *
 * Modules access settings through the SettingsStore interface in their
 * ModuleContext — they never know which implementation is behind it.
 */

import type { SettingsStore } from "../module-system/types.js";

/** Type for a watch callback function. */
type WatchHandler = (newValue: unknown) => void;

/**
 * In-memory settings store for testing and non-browser contexts.
 *
 * Stores settings in a plain Map. Supports get, set, and watch.
 * Watch handlers fire synchronously when a value is set.
 *
 * @example
 * ```ts
 * const store = new InMemorySettingsStore({ "general.masterVolume": 80 });
 * await store.get("general.masterVolume"); // 80
 * await store.set("general.masterVolume", 50);
 * ```
 */
export class InMemorySettingsStore implements SettingsStore {
  /** Stored values keyed by setting path. */
  private readonly data: Map<string, unknown>;

  /** Watch handlers keyed by setting path. */
  private readonly watchers = new Map<string, Set<WatchHandler>>();

  /**
   * @param initial - Optional initial values to populate the store.
   */
  constructor(initial?: Record<string, unknown>) {
    this.data = new Map(Object.entries(initial ?? {}));
  }

  /** Get a setting value by key. Returns undefined if not set. */
  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  /** Set a setting value and notify watchers. */
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);

    // Notify watchers for this key.
    //
    // Two invariants matter here, matching MessageBusImpl.publish:
    // 1. Snapshot before iteration — a watcher that registers a new
    //    watcher for the same key must not have its new watcher fire
    //    for the current notification; it should only start on the
    //    next set() call.
    // 2. Isolate handler errors — one throwing watcher must not
    //    prevent remaining watchers from receiving the notification.
    //    Without this, a buggy component (e.g., a UI throwing during
    //    a re-render triggered by a setting change) would silently
    //    break the sound engine's mute/config cache refresh.
    const handlers = this.watchers.get(key);
    if (handlers) {
      const snapshot = [...handlers];
      for (const handler of snapshot) {
        try {
          handler(value);
        } catch (error) {
          console.error(`[SettingsStore] Watcher error on key "${key}":`, error);
        }
      }
    }
  }

  /**
   * Watch for changes to a setting.
   * Returns an unwatch function.
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
