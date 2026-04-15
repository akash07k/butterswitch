/**
 * @module sound-engine/event-registry
 *
 * Declarative registry of all browser events the sound engine can respond to.
 *
 * This is pure data — no logic, no side effects. Each entry describes one
 * browser event: which API, what it's called, when it fires, which platforms
 * support it, and what permissions it needs.
 *
 * Adding a new browser event = adding one object to this array.
 * The event engine reads this data to wire up listeners generically.
 *
 * Events are organized into three tiers:
 * - Tier 1 (Essential): Enabled by default, core browser events
 * - Tier 2 (Useful): Disabled by default, opt-in for interested users
 * - Tier 3 (Advanced): Hidden by default, power users only
 */

import type { EventDefinition } from "./types.js";

// ─────────────────────────────────────────────────────────────
// Tier 1 — Essential (enabled by default)
// ─────────────────────────────────────────────────────────────

const TIER_1_EVENTS: EventDefinition[] = [
  // === Tabs ===
  {
    id: "tabs.onCreated",
    namespace: "tabs",
    event: "onCreated",
    label: "Tab Created",
    description: "A new tab was created.",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },
  {
    id: "tabs.onRemoved",
    namespace: "tabs",
    event: "onRemoved",
    label: "Tab Closed",
    description: "A tab was closed.",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },
  {
    id: "tabs.onActivated",
    namespace: "tabs",
    event: "onActivated",
    label: "Tab Switched",
    description: "The active tab changed in a window.",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },
  {
    id: "tabs.onUpdated.loading",
    namespace: "tabs",
    event: "onUpdated",
    label: "Page Loading",
    description: "A tab started loading a new page.",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
    filter: (_tabId: unknown, changeInfo: unknown) =>
      (changeInfo as { status?: string })?.status === "loading",
  },
  {
    id: "tabs.onUpdated.complete",
    namespace: "tabs",
    event: "onUpdated",
    label: "Page Loaded",
    description: "A tab finished loading a page.",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
    filter: (_tabId: unknown, changeInfo: unknown) =>
      (changeInfo as { status?: string })?.status === "complete",
  },
  {
    id: "tabs.onUpdated.title",
    namespace: "tabs",
    event: "onUpdated",
    label: "Tab Title Changed",
    description: "A tab's page title changed (useful for screen reader users).",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
    filter: (_tabId: unknown, changeInfo: unknown) =>
      (changeInfo as { title?: string })?.title !== undefined,
  },
  {
    id: "tabs.onMoved",
    namespace: "tabs",
    event: "onMoved",
    label: "Tab Moved",
    description: "A tab was moved within a window.",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },
  {
    id: "tabs.onDetached",
    namespace: "tabs",
    event: "onDetached",
    label: "Tab Detached",
    description: "A tab was detached from a window (e.g., dragged out).",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },
  {
    id: "tabs.onAttached",
    namespace: "tabs",
    event: "onAttached",
    label: "Tab Attached",
    description: "A tab was attached to a window.",
    tier: 1,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },

  // === Navigation ===
  {
    id: "webNavigation.onBeforeNavigate",
    namespace: "webNavigation",
    event: "onBeforeNavigate",
    label: "Navigation Starting",
    description: "A navigation is about to begin.",
    tier: 1,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    permissions: ["webNavigation"],
  },
  {
    id: "webNavigation.onCommitted",
    namespace: "webNavigation",
    event: "onCommitted",
    label: "Navigation Committed",
    description: "A navigation was committed (URL changed).",
    tier: 1,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    permissions: ["webNavigation"],
  },
  {
    id: "webNavigation.onDOMContentLoaded",
    namespace: "webNavigation",
    event: "onDOMContentLoaded",
    label: "DOM Ready",
    description: "The DOM content of a page finished loading.",
    tier: 1,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    permissions: ["webNavigation"],
  },
  {
    id: "webNavigation.onCompleted",
    namespace: "webNavigation",
    event: "onCompleted",
    label: "Page Fully Loaded",
    description: "A page and all its resources finished loading.",
    tier: 1,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    permissions: ["webNavigation"],
  },
  {
    id: "webNavigation.onErrorOccurred",
    namespace: "webNavigation",
    event: "onErrorOccurred",
    label: "Navigation Error",
    description: "A navigation failed with an error.",
    tier: 1,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    isError: true,
    permissions: ["webNavigation"],
  },
  {
    id: "webNavigation.onHistoryStateUpdated",
    namespace: "webNavigation",
    event: "onHistoryStateUpdated",
    label: "History State Changed",
    description: "The history state was updated (pushState/replaceState).",
    tier: 1,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    permissions: ["webNavigation"],
  },

  // === Bookmarks ===
  {
    id: "bookmarks.onCreated",
    namespace: "bookmarks",
    event: "onCreated",
    label: "Bookmark Added",
    description: "A bookmark was created.",
    tier: 1,
    category: "bookmarks",
    platforms: ["chrome", "firefox"],

    permissions: ["bookmarks"],
  },
  {
    id: "bookmarks.onRemoved",
    namespace: "bookmarks",
    event: "onRemoved",
    label: "Bookmark Removed",
    description: "A bookmark was deleted.",
    tier: 1,
    category: "bookmarks",
    platforms: ["chrome", "firefox"],

    permissions: ["bookmarks"],
  },
  {
    id: "bookmarks.onChanged",
    namespace: "bookmarks",
    event: "onChanged",
    label: "Bookmark Changed",
    description: "A bookmark's title or URL was changed.",
    tier: 1,
    category: "bookmarks",
    platforms: ["chrome", "firefox"],

    permissions: ["bookmarks"],
  },
  {
    id: "bookmarks.onMoved",
    namespace: "bookmarks",
    event: "onMoved",
    label: "Bookmark Moved",
    description: "A bookmark was moved to a different folder.",
    tier: 1,
    category: "bookmarks",
    platforms: ["chrome", "firefox"],

    permissions: ["bookmarks"],
  },

  // === Downloads ===
  {
    id: "downloads.onCreated",
    namespace: "downloads",
    event: "onCreated",
    label: "Download Started",
    description: "A new download began.",
    tier: 1,
    category: "downloads",
    platforms: ["chrome", "firefox"],

    permissions: ["downloads"],
  },
  {
    id: "downloads.onChanged.complete",
    namespace: "downloads",
    event: "onChanged",
    label: "Download Completed",
    description: "A download finished successfully.",
    tier: 1,
    category: "downloads",
    platforms: ["chrome", "firefox"],

    permissions: ["downloads"],
    filter: (delta: unknown) =>
      (delta as { state?: { current?: string } })?.state?.current === "complete",
  },
  {
    id: "downloads.onChanged.paused",
    namespace: "downloads",
    event: "onChanged",
    label: "Download Paused",
    description: "A download was paused.",
    tier: 1,
    category: "downloads",
    platforms: ["chrome", "firefox"],

    permissions: ["downloads"],
    filter: (delta: unknown) =>
      (delta as { paused?: { current?: boolean } })?.paused?.current === true,
  },
  {
    id: "downloads.onChanged.resumed",
    namespace: "downloads",
    event: "onChanged",
    label: "Download Resumed",
    description: "A paused download was resumed.",
    tier: 1,
    category: "downloads",
    platforms: ["chrome", "firefox"],

    permissions: ["downloads"],
    filter: (delta: unknown) => {
      const d = delta as { paused?: { previous?: boolean; current?: boolean } };
      return d?.paused?.previous === true && d?.paused?.current === false;
    },
  },
  {
    id: "downloads.onChanged.failed",
    namespace: "downloads",
    event: "onChanged",
    label: "Download Failed",
    description: "A download failed with an error.",
    tier: 1,
    category: "downloads",
    platforms: ["chrome", "firefox"],

    isError: true,
    permissions: ["downloads"],
    filter: (delta: unknown) =>
      (delta as { state?: { current?: string } })?.state?.current === "interrupted",
  },

  // === Windows ===
  {
    id: "windows.onCreated",
    namespace: "windows",
    event: "onCreated",
    label: "Window Opened",
    description: "A new browser window was opened.",
    tier: 1,
    category: "windows",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  {
    id: "windows.onRemoved",
    namespace: "windows",
    event: "onRemoved",
    label: "Window Closed",
    description: "A browser window was closed.",
    tier: 1,
    category: "windows",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  {
    id: "windows.onFocusChanged",
    namespace: "windows",
    event: "onFocusChanged",
    label: "Window Focus Changed",
    description: "A different window received focus.",
    tier: 1,
    category: "windows",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },

  // === Runtime ===
  {
    id: "runtime.onInstalled",
    namespace: "runtime",
    event: "onInstalled",
    label: "Extension Installed/Updated",
    description: "The extension was installed or updated.",
    tier: 1,
    category: "runtime",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  {
    id: "runtime.onStartup",
    namespace: "runtime",
    event: "onStartup",
    label: "Browser Started",
    description: "The browser started and the extension is loaded.",
    tier: 1,
    category: "runtime",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
];

// ─────────────────────────────────────────────────────────────
// Tier 2 — Useful (disabled by default, user can enable)
// ─────────────────────────────────────────────────────────────

const TIER_2_EVENTS: EventDefinition[] = [
  // === Tabs (extended) ===
  {
    id: "tabs.onUpdated.url",
    namespace: "tabs",
    event: "onUpdated",
    label: "Tab Navigated (URL Changed)",
    description: "A tab navigated to a new URL within the same tab.",
    tier: 2,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
    filter: (_tabId: unknown, changeInfo: unknown) =>
      (changeInfo as { url?: string })?.url !== undefined,
  },
  {
    id: "tabs.onUpdated.pinned",
    namespace: "tabs",
    event: "onUpdated",
    label: "Tab Pinned/Unpinned",
    description: "A tab was pinned or unpinned.",
    tier: 2,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
    filter: (_tabId: unknown, changeInfo: unknown) =>
      (changeInfo as { pinned?: boolean })?.pinned !== undefined,
  },
  {
    id: "tabs.onUpdated.audible",
    namespace: "tabs",
    event: "onUpdated",
    label: "Tab Audio Started/Stopped",
    description: "A tab started or stopped playing audio.",
    tier: 2,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
    filter: (_tabId: unknown, changeInfo: unknown) =>
      (changeInfo as { audible?: boolean })?.audible !== undefined,
  },
  {
    id: "tabs.onUpdated.mutedInfo",
    namespace: "tabs",
    event: "onUpdated",
    label: "Tab Muted/Unmuted",
    description: "A tab was muted or unmuted.",
    tier: 2,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
    filter: (_tabId: unknown, changeInfo: unknown) =>
      (changeInfo as { mutedInfo?: unknown })?.mutedInfo !== undefined,
  },
  {
    id: "tabs.onHighlighted",
    namespace: "tabs",
    event: "onHighlighted",
    label: "Tab Highlighted",
    description: "One or more tabs were highlighted/selected.",
    tier: 2,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },
  {
    id: "tabs.onReplaced",
    namespace: "tabs",
    event: "onReplaced",
    label: "Tab Replaced",
    description: "A tab was replaced (e.g., by a prerendered page).",
    tier: 2,
    category: "tabs",
    platforms: ["chrome"],

    permissions: ["tabs"],
  },
  {
    id: "tabs.onZoomChange",
    namespace: "tabs",
    event: "onZoomChange",
    label: "Zoom Changed",
    description: "The zoom level of a tab changed.",
    tier: 2,
    category: "tabs",
    platforms: ["chrome", "firefox"],

    permissions: ["tabs"],
  },

  // === Tab Groups (Chrome only) ===
  {
    id: "tabGroups.onCreated",
    namespace: "tabGroups",
    event: "onCreated",
    label: "Tab Group Created",
    description: "A tab group was created.",
    tier: 2,
    category: "tab-groups",
    platforms: ["chrome"],

    permissions: [],
  },
  {
    id: "tabGroups.onRemoved",
    namespace: "tabGroups",
    event: "onRemoved",
    label: "Tab Group Removed",
    description: "A tab group was removed.",
    tier: 2,
    category: "tab-groups",
    platforms: ["chrome"],

    permissions: [],
  },
  {
    id: "tabGroups.onUpdated",
    namespace: "tabGroups",
    event: "onUpdated",
    label: "Tab Group Updated",
    description: "A tab group's properties changed (title, color).",
    tier: 2,
    category: "tab-groups",
    platforms: ["chrome"],

    permissions: [],
  },
  {
    id: "tabGroups.onMoved",
    namespace: "tabGroups",
    event: "onMoved",
    label: "Tab Group Moved",
    description: "A tab group was moved within a window.",
    tier: 2,
    category: "tab-groups",
    platforms: ["chrome"],

    permissions: [],
  },

  // === History ===
  {
    id: "history.onVisited",
    namespace: "history",
    event: "onVisited",
    label: "URL Visited",
    description: "A URL was added to the browser history.",
    tier: 2,
    category: "history",
    platforms: ["chrome", "firefox"],

    permissions: ["history"],
  },
  {
    id: "history.onVisitRemoved",
    namespace: "history",
    event: "onVisitRemoved",
    label: "History Removed",
    description: "One or more history entries were removed.",
    tier: 2,
    category: "history",
    platforms: ["chrome", "firefox"],

    permissions: ["history"],
  },

  // === Omnibox ===
  {
    id: "omnibox.onInputStarted",
    namespace: "omnibox",
    event: "onInputStarted",
    label: "Omnibox Activated",
    description: "The user started typing in the omnibox.",
    tier: 2,
    category: "omnibox",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  {
    id: "omnibox.onInputEntered",
    namespace: "omnibox",
    event: "onInputEntered",
    label: "Omnibox Submitted",
    description: "The user submitted an omnibox entry.",
    tier: 2,
    category: "omnibox",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  {
    id: "omnibox.onInputCancelled",
    namespace: "omnibox",
    event: "onInputCancelled",
    label: "Omnibox Cancelled",
    description: "The user cancelled omnibox input.",
    tier: 2,
    category: "omnibox",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },

  // === Idle ===
  {
    id: "idle.onStateChanged.active",
    namespace: "idle",
    event: "onStateChanged",
    label: "System Active",
    description: "The system became active after being idle.",
    tier: 2,
    category: "idle",
    platforms: ["chrome", "firefox"],

    permissions: ["idle"],
    filter: (state: unknown) => state === "active",
  },
  {
    id: "idle.onStateChanged.idle",
    namespace: "idle",
    event: "onStateChanged",
    label: "System Idle",
    description: "The system became idle (no user input).",
    tier: 2,
    category: "idle",
    platforms: ["chrome", "firefox"],

    permissions: ["idle"],
    filter: (state: unknown) => state === "idle",
  },
  {
    id: "idle.onStateChanged.locked",
    namespace: "idle",
    event: "onStateChanged",
    label: "System Locked",
    description: "The system was locked by the user.",
    tier: 2,
    category: "idle",
    platforms: ["chrome", "firefox"],

    permissions: ["idle"],
    filter: (state: unknown) => state === "locked",
  },

  // === Permissions ===
  {
    id: "permissions.onAdded",
    namespace: "permissions",
    event: "onAdded",
    label: "Permission Granted",
    description: "A new permission was granted to an extension.",
    tier: 2,
    category: "permissions",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  {
    id: "permissions.onRemoved",
    namespace: "permissions",
    event: "onRemoved",
    label: "Permission Revoked",
    description: "A permission was revoked from an extension.",
    tier: 2,
    category: "permissions",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },

  // === Management ===
  {
    id: "management.onInstalled",
    namespace: "management",
    event: "onInstalled",
    label: "Extension Installed",
    description: "An extension was installed.",
    tier: 2,
    category: "management",
    platforms: ["chrome", "firefox"],

    permissions: ["management"],
  },
  {
    id: "management.onUninstalled",
    namespace: "management",
    event: "onUninstalled",
    label: "Extension Uninstalled",
    description: "An extension was uninstalled.",
    tier: 2,
    category: "management",
    platforms: ["chrome", "firefox"],

    permissions: ["management"],
  },
  {
    id: "management.onEnabled",
    namespace: "management",
    event: "onEnabled",
    label: "Extension Enabled",
    description: "An extension was enabled.",
    tier: 2,
    category: "management",
    platforms: ["chrome", "firefox"],

    permissions: ["management"],
  },
  {
    id: "management.onDisabled",
    namespace: "management",
    event: "onDisabled",
    label: "Extension Disabled",
    description: "An extension was disabled.",
    tier: 2,
    category: "management",
    platforms: ["chrome", "firefox"],

    permissions: ["management"],
  },

  // === Navigation (extended) ===
  {
    id: "webNavigation.onCreatedNavigationTarget",
    namespace: "webNavigation",
    event: "onCreatedNavigationTarget",
    label: "New Nav Target",
    description: "A new navigation target was created (e.g., link opened in new tab).",
    tier: 2,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    permissions: ["webNavigation"],
  },
  {
    id: "webNavigation.onReferenceFragmentUpdated",
    namespace: "webNavigation",
    event: "onReferenceFragmentUpdated",
    label: "Hash Changed",
    description: "The URL hash fragment changed (e.g., #section).",
    tier: 2,
    category: "navigation",
    platforms: ["chrome", "firefox"],

    permissions: ["webNavigation"],
  },

  // === Other ===
  {
    id: "commands.onCommand",
    namespace: "commands",
    event: "onCommand",
    label: "Keyboard Shortcut",
    description: "A registered keyboard shortcut was pressed.",
    tier: 2,
    category: "other",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  {
    id: "notifications.onShown",
    namespace: "notifications",
    event: "onShown",
    label: "Notification Shown",
    description: "A notification was displayed to the user (Firefox only).",
    tier: 2,
    category: "other",
    platforms: ["firefox"],

    permissions: ["notifications"],
  },
  {
    id: "notifications.onClicked",
    namespace: "notifications",
    event: "onClicked",
    label: "Notification Clicked",
    description: "A notification was clicked by the user.",
    tier: 2,
    category: "other",
    platforms: ["chrome", "firefox"],

    permissions: ["notifications"],
  },
  {
    id: "notifications.onClosed",
    namespace: "notifications",
    event: "onClosed",
    label: "Notification Closed",
    description: "A notification was closed.",
    tier: 2,
    category: "other",
    platforms: ["chrome", "firefox"],

    permissions: ["notifications"],
  },
  {
    id: "cookies.onChanged",
    namespace: "cookies",
    event: "onChanged",
    label: "Cookie Changed",
    description: "A cookie was set, changed, or removed.",
    tier: 2,
    category: "other",
    platforms: ["chrome", "firefox"],

    permissions: ["cookies"],
  },
  {
    id: "runtime.onUpdateAvailable",
    namespace: "runtime",
    event: "onUpdateAvailable",
    label: "Update Available",
    description: "An update for the extension is available.",
    tier: 2,
    category: "runtime",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
];

// ─────────────────────────────────────────────────────────────
// Tier 3 — Advanced (hidden by default, power users)
// ─────────────────────────────────────────────────────────────

const TIER_3_EVENTS: EventDefinition[] = [
  {
    id: "runtime.onConnect",
    namespace: "runtime",
    event: "onConnect",
    label: "Port Connected",
    description: "A port connection was established.",
    tier: 3,
    category: "runtime",
    platforms: ["chrome", "firefox"],

    permissions: [],
  },
  // NOTE: runtime.onMessage intentionally excluded — registering a listener
  // on it would intercept the extension's own LOG and PREVIEW_SOUND messages,
  // causing audio feedback loops where each sound triggers a log which triggers a sound.
  {
    id: "runtime.onSuspend",
    namespace: "runtime",
    event: "onSuspend",
    label: "Worker Suspending",
    description: "The service worker is about to be suspended.",
    tier: 3,
    category: "runtime",
    platforms: ["chrome"],

    permissions: [],
  },
];

/**
 * Complete event registry — all browser events the sound engine supports.
 * Sorted by tier (1 first, then 2, then 3).
 */
export const EVENT_REGISTRY: EventDefinition[] = [
  ...TIER_1_EVENTS,
  ...TIER_2_EVENTS,
  ...TIER_3_EVENTS,
];

/** Number of Tier 1 (essential) events. */
export const TIER_1_COUNT = TIER_1_EVENTS.length;

/** Number of Tier 2 (useful) events. */
export const TIER_2_COUNT = TIER_2_EVENTS.length;

/** Number of Tier 3 (advanced) events. */
export const TIER_3_COUNT = TIER_3_EVENTS.length;
