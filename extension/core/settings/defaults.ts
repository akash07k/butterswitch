/**
 * @module settings/defaults
 *
 * Default values for all ButterSwitch settings.
 *
 * These defaults are used when a setting has never been set by the user.
 * They represent the out-of-the-box experience — a sensible starting
 * point that works immediately without configuration.
 *
 * The log level defaults to INFO (not DEBUG) to keep noise low
 * for end users. Developers can lower it in the options page.
 */

import type { ButterSwitchSettings } from "./types.js";

/** Default values for all extension settings. */
export const DEFAULT_SETTINGS: ButterSwitchSettings = {
  general: {
    masterVolume: 80,
    activeTheme: "subtle",
    muted: false,
    logLevel: 1, // LogLevel.INFO
    logServerUrl: "ws://localhost:8089",
    enabledModules: ["sound-engine"],
  },

  sounds: {
    events: {},
  },

  themes: {
    customThemes: [],
  },

  hotkeys: {
    bindings: {
      // Global shortcuts — handled by browser.commands API, work from any tab
      "global:toggle-mute": "Alt+M",
      "global:open-options": "Alt+Shift+O",
    },
  },
};
