/**
 * @module sound-engine/theme-manager
 *
 * Manages sound themes — loading, switching, and resolving
 * which sound file to play for a given event.
 *
 * The theme manager is the single source of truth for
 * event → sound file resolution. It looks up the active theme's
 * mappings first, then falls back to tier-based defaults.
 *
 * Built-in themes are loaded from extension assets.
 * Custom themes are stored in IndexedDB (imported as .zip by user).
 */

import {
  validateThemeManifest,
  type ThemeManifest,
  type ThemeValidationError,
} from "./theme-schema.js";

/**
 * Result of loading a theme.
 */
export interface ThemeLoadResult {
  /** Whether the theme loaded successfully. */
  success: boolean;

  /** Validation errors if loading failed. */
  errors?: ThemeValidationError[];
}

/**
 * Basic info about a loaded theme (for UI display).
 */
export interface ThemeInfo {
  /** Theme display name. */
  name: string;

  /** Theme description. */
  description: string;

  /** Theme author. */
  author: string;

  /** Theme version. */
  version: string;

  /** Number of event-to-sound mappings. */
  mappingCount: number;
}

/** Internal representation of a loaded theme. */
interface LoadedTheme {
  /** The validated manifest. */
  manifest: ThemeManifest;

  /** Base URL path for resolving sound file URLs. */
  basePath: string;
}

/**
 * Loads, stores, and resolves sound themes.
 *
 * @example
 * ```ts
 * const manager = new ThemeManager();
 * manager.loadTheme("subtle", manifest, "/assets/sounds/subtle");
 * manager.setActiveTheme("subtle");
 *
 * const soundUrl = manager.resolveSound("tabs.onCreated");
 * // => "/assets/sounds/subtle/tab-created.ogg"
 * ```
 */
export class ThemeManager {
  /** Loaded themes keyed by theme ID. */
  private readonly themes = new Map<string, LoadedTheme>();

  /** Currently active theme ID. */
  private activeThemeId: string | null = null;

  /**
   * Load a theme from its manifest and base path.
   *
   * Validates the manifest before accepting it. Invalid themes
   * are rejected with a list of errors.
   *
   * @param themeId - Unique identifier for this theme.
   * @param manifest - The parsed theme.json content.
   * @param basePath - URL path prefix for sound files (e.g., "/assets/sounds/subtle").
   * @returns Load result with success status and any validation errors.
   */
  loadTheme(themeId: string, manifest: ThemeManifest, basePath: string): ThemeLoadResult {
    const errors = validateThemeManifest(manifest);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    this.themes.set(themeId, { manifest, basePath });
    return { success: true };
  }

  /**
   * Set the active theme by ID.
   * The active theme is used for all sound resolution.
   *
   * @throws Error if the theme ID is not loaded.
   */
  setActiveTheme(themeId: string): void {
    if (!this.themes.has(themeId)) {
      throw new Error(`Theme "${themeId}" is not loaded.`);
    }
    this.activeThemeId = themeId;
  }

  /** Get the active theme ID, or null if none set. */
  getActiveThemeId(): string | null {
    return this.activeThemeId;
  }

  /** Get all loaded theme IDs. */
  getAvailableThemes(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Get metadata about a loaded theme (for UI display).
   *
   * @returns Theme info, or undefined if the theme isn't loaded.
   */
  getThemeInfo(themeId: string): ThemeInfo | undefined {
    const loaded = this.themes.get(themeId);
    if (!loaded) return undefined;

    return {
      name: loaded.manifest.name,
      description: loaded.manifest.description,
      author: loaded.manifest.author,
      version: loaded.manifest.version,
      mappingCount: Object.keys(loaded.manifest.mappings).length,
    };
  }

  /**
   * Resolve which sound file URL to play for a given event.
   *
   * Resolution order:
   * 1. Direct mapping in the active theme (event ID → filename)
   * 2. Error fallback (if isError is true)
   * 3. Tier-based fallback (tier1/tier2/tier3)
   * 4. Generic info fallback
   * 5. null (no sound available)
   *
   * @param eventId - The event definition ID (e.g., "tabs.onCreated").
   * @param tier - The event's tier (1, 2, or 3) for fallback resolution.
   * @param isError - Whether this is an error-type event.
   * @returns Full URL to the sound file, or null if no sound is available.
   */
  resolveSound(eventId: string, tier?: 1 | 2 | 3, isError?: boolean): string | null {
    if (!this.activeThemeId) return null;

    const loaded = this.themes.get(this.activeThemeId);
    if (!loaded) return null;

    const { manifest, basePath } = loaded;

    // 1. Direct mapping
    const directMapping = manifest.mappings[eventId];
    if (directMapping) {
      return `${basePath}/${directMapping}`;
    }

    // 2. Error fallback
    if (isError && manifest.fallbacks?.error) {
      return `${basePath}/${manifest.fallbacks.error}`;
    }

    // 3. Tier-based fallback
    if (tier && manifest.fallbacks) {
      const tierKey = `tier${tier}` as keyof typeof manifest.fallbacks;
      const tierFallback = manifest.fallbacks[tierKey];
      if (tierFallback) {
        return `${basePath}/${tierFallback}`;
      }
    }

    // 4. Generic info fallback
    if (manifest.fallbacks?.info) {
      return `${basePath}/${manifest.fallbacks.info}`;
    }

    // 5. No sound available
    return null;
  }
}
