/**
 * @module sound-engine/types
 *
 * Type definitions for the sound engine module.
 * Includes event definitions, categories, and theme-related types.
 */

/**
 * A single browser event that the sound engine can respond to.
 *
 * Adding a new event = adding one EventDefinition to the registry array.
 * The event engine reads these definitions to wire up listeners generically.
 */
export interface EventDefinition {
  /**
   * Unique event identifier.
   * For sub-events, uses dot notation: "tabs.onUpdated.loading".
   */
  id: string;

  /** Browser API namespace (e.g., "tabs", "bookmarks"). */
  namespace: string;

  /** Event name within the namespace (e.g., "onCreated", "onRemoved"). */
  event: string;

  /** Human-readable label for the settings UI. */
  label: string;

  /** Description of when this event fires. */
  description: string;

  /**
   * Display tier for UI organization:
   * - 1 = essential (enabled by default, shown prominently)
   * - 2 = useful (disabled by default, shown in expanded view)
   * - 3 = advanced (hidden by default, power users only)
   */
  tier: 1 | 2 | 3;

  /** Category for grouping in the settings UI. */
  category: EventCategory;

  /** Whether this is an error-type event (uses error fallback sound). */
  isError?: boolean;

  /** Which browsers support this event. */
  platforms: ("chrome" | "firefox")[];

  /** Browser permissions required to listen to this event. */
  permissions: string[];

  /**
   * Suppression priority. Higher = more important. Default 0.
   *
   * When two events arrive within the global cooldown window, the gate
   * normally lets the first one through and suppresses the second. With
   * priority, an arriving event whose priority is **strictly greater
   * than** the in-flight event can preempt — its sound plays, possibly
   * overlapping the first one's tail. This solves cascade cases where
   * the second event is more informative than the first (e.g., bfcache
   * back/forward navigation fires onBeforeNavigate and onCompleted in
   * the same millisecond; onCompleted should win because "page is
   * ready to read" is the actionable signal for the user).
   *
   * Suggested scale: 0 (default), 10 (informative completion events),
   * 20 (errors / critical events). Equal priority does not preempt —
   * keeps the cooldown's anti-cascade purpose intact.
   */
  priority?: number;

  /**
   * Optional filter function for sub-events.
   * Called with the event arguments — return true to trigger a sound.
   * Used for events that fire for multiple reasons (e.g., tabs.onUpdated).
   */
  filter?: (...args: unknown[]) => boolean;

  /**
   * Optional data extractor for logging.
   * Extracts relevant data from event arguments for structured logging.
   */
  extractData?: (...args: unknown[]) => Record<string, unknown>;

  /**
   * Optional custom handler called when the event fires.
   *
   * Receives the raw browser event arguments. Can perform any side effects
   * (webhooks, notifications, storage writes) and control the sound behavior
   * via the return value:
   * - `null` or `undefined` — use default sound resolution
   * - `{ suppress: true }` — suppress the sound entirely
   * - `{ soundOverride: "filename.ogg" }` — play a specific sound file
   *   from the active theme directory instead of the mapped sound
   * - `{ data: {...} }` — attach extra data to the log entry
   *
   * All fields in the result are optional and can be combined.
   * The handler can be async for webhook calls or other async operations.
   */
  handler?: (...args: unknown[]) => EventHandlerResult | Promise<EventHandlerResult>;
}

/**
 * Result returned by a custom event handler.
 * Controls sound behavior and attaches extra data.
 */
export interface EventHandlerResult {
  /** If true, suppress the sound entirely (no playback). */
  suppress?: boolean;
  /** Override the resolved sound with a specific filename from the active theme. */
  soundOverride?: string;
  /** Extra data to attach to the log entry. */
  data?: Record<string, unknown>;
}

/**
 * Event categories for grouping in the settings UI.
 * Each category maps to a section in the Sound Events table.
 */
export type EventCategory =
  | "tabs"
  | "navigation"
  | "bookmarks"
  | "downloads"
  | "windows"
  | "runtime"
  | "history"
  | "tab-groups"
  | "omnibox"
  | "idle"
  | "permissions"
  | "management"
  | "other";
