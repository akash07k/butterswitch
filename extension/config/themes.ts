/**
 * @module config/themes
 *
 * Built-in theme registry. Add new themes here — all UI components,
 * the sound engine, and the cycle-theme shortcut pick them up automatically.
 */

/** Definition of a built-in sound theme. */
export interface ThemeDefinition {
  /** Unique theme identifier (used in storage and theme.json lookups). */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Short description shown in the theme selector. */
  description: string;
  /** Path relative to extension public dir (e.g., "sounds/subtle"). */
  path: string;
}

/**
 * All built-in themes shipped with the extension.
 * Order determines display order in the theme selector.
 */
export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  {
    id: "pulse",
    name: "Pulse",
    description: "Responsive audio cues with a rhythmic, modern feel.",
    path: "sounds/pulse",
  },
];

/** The default theme ID (first theme in the registry). */
export const DEFAULT_THEME_ID = BUILT_IN_THEMES[0]!.id;
