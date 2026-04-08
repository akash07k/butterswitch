/**
 * @module settings/types
 *
 * Type definitions for the ButterSwitch settings schema.
 *
 * These types define the shape of all user-configurable settings.
 * The settings are stored in the browser's extension storage via
 * WXT's storage API and accessed by modules through the SettingsStore
 * interface in their ModuleContext.
 */

import type { LogLevel } from "@butterswitch/logger";

/**
 * Root settings object for the entire extension.
 * Each section corresponds to a tab in the options page.
 */
export interface ButterSwitchSettings {
  general: GeneralSettings;
  sounds: SoundSettings;
  themes: ThemeSettings;
  hotkeys: HotkeySettings;
}

/**
 * General extension settings.
 * Displayed in the "General" tab of the options page.
 */
export interface GeneralSettings {
  /** Master volume (0–100). Controls overall audio output. */
  masterVolume: number;

  /** Active theme ID. Determines which sound theme is used. */
  activeTheme: string;

  /** Global mute. When true, no sounds are played. */
  muted: boolean;

  /** Minimum log level for the logger. */
  logLevel: LogLevel;

  /** WebSocket server URL for log streaming. */
  logServerUrl: string;

  /** List of enabled module IDs. */
  enabledModules: string[];
}

/**
 * Sound-related settings.
 * Per-event configuration for the sound engine.
 */
export interface SoundSettings {
  /**
   * Per-event configuration.
   * Key is the event ID (e.g., "tabs.onCreated").
   * Value is the event-specific config.
   */
  events: Record<string, EventConfig>;
}

/**
 * Configuration for a single sound event.
 * Controls how/whether a sound plays for a specific browser event.
 */
export interface EventConfig {
  /** Whether this event plays a sound. */
  enabled: boolean;

  /** Volume override (0–100). Null means use master volume. */
  volume?: number;

  /** Pitch / playback rate (0.5–2.0). Null means normal speed. */
  pitch?: number;
}

/**
 * Theme-related settings.
 */
export interface ThemeSettings {
  /** IDs of user-installed custom themes (stored in IndexedDB). */
  customThemes: string[];
}

/**
 * Hotkey-related settings.
 */
export interface HotkeySettings {
  /**
   * User-customizable hotkey bindings.
   * Key is the command ID (e.g., "sound-engine:toggle-mute").
   * Value is the hotkey string (e.g., "Alt+m").
   */
  bindings: Record<string, string>;
}
