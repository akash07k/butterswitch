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

  /** Which browsers support this event. */
  platforms: ("chrome" | "firefox")[];

  /** Whether this event is enabled in a fresh install. */
  defaultEnabled: boolean;

  /** Browser permissions required to listen to this event. */
  permissions: string[];

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
  | "web-request"
  | "other";
