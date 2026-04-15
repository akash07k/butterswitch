/**
 * @module sound-engine
 *
 * The sound engine module — maps browser events to audio playback.
 *
 * This is the first feature module of ButterSwitch. It implements
 * the ButterSwitchModule interface and orchestrates:
 *
 * 1. **Audio backend** — platform-specific playback (Chrome offscreen / Firefox direct)
 * 2. **Event engine** — wires browser API listeners from the event registry
 * 3. **Theme manager** — resolves which sound to play for each event
 *
 * The flow: browser event fires → event engine publishes to message bus →
 * this module receives the message → resolves sound via theme manager →
 * plays via audio backend.
 */

import type { ButterSwitchModule, ModuleContext } from "../../core/module-system/types.js";
import type { AudioBackend } from "./audio-backends/types.js";
import { EventEngine, BROWSER_EVENT_CHANNEL, type BrowserEventMessage } from "./event-engine.js";
import { ThemeManager } from "./theme-manager.js";
import { EVENT_REGISTRY } from "./event-registry.js";
import { BUILT_IN_THEMES, DEFAULT_THEME_ID } from "../../config/themes.js";
import { getEventDefaults } from "../../config/events.js";

/** Module ID used for registration and dependency references. */
export const SOUND_ENGINE_MODULE_ID = "sound-engine";

/**
 * Sound engine module — implements ButterSwitchModule.
 *
 * Lifecycle:
 * - **initialize**: Load theme, wire event listeners
 * - **activate**: Subscribe to browser-event messages and start playing sounds
 * - **deactivate**: Unsubscribe from messages, stop all sounds
 * - **dispose**: Release audio backend and all resources
 *
 * The audio backend must be injected via setAudioBackend() before
 * initialize() is called. This is done by the background script
 * to avoid bundling Howler.js into Chrome's service worker.
 */
export class SoundEngineModule implements ButterSwitchModule {
  readonly id = SOUND_ENGINE_MODULE_ID;
  readonly name = "Sound Engine";
  readonly version = "1.0.0";

  /** Module context provided during initialization. */
  private context: ModuleContext | null = null;

  /** Platform-specific audio playback backend. */
  private backend: AudioBackend | null = null;

  /** Wires browser API listeners from the event registry. */
  private eventEngine: EventEngine | null = null;

  /** Resolves event IDs to sound file URLs. */
  private themeManager: ThemeManager | null = null;

  /** Unsubscribe function for the message bus subscription. */
  private unsubscribe: (() => void) | null = null;

  /** Unwatch functions for settings watchers. */
  private unwatchers: (() => void)[] = [];

  /**
   * Inject the platform-specific audio backend.
   * Must be called BEFORE initialize().
   *
   * The background script creates the right backend (Chrome offscreen
   * or Firefox direct) and injects it here. This avoids importing
   * Howler.js in Chrome's service worker (which has no DOM).
   *
   * @param backend - The platform-specific audio backend (Chrome or Firefox).
   */
  setAudioBackend(backend: AudioBackend): void {
    this.backend = backend;
  }

  /** Get the theme manager (for preview sound). Null if not initialized. */
  getThemeManager(): ThemeManager | null {
    return this.themeManager;
  }

  /** Get the audio backend (for preview sound). Null if not injected. */
  getBackend(): AudioBackend | null {
    return this.backend;
  }

  /**
   * Initialize the sound engine: set up audio backend, load the default
   * theme, and register browser event listeners from the event registry.
   * @param context - Module context providing logger, messageBus, settings, and platform.
   * @throws Error if setAudioBackend() was not called before this method.
   */
  async initialize(context: ModuleContext): Promise<void> {
    this.context = context;
    const { logger } = context;

    // 1. Audio backend must be injected before initialization.
    if (!this.backend) {
      throw new Error("Audio backend not set. Call setAudioBackend() before initialize().");
    }

    await this.backend.initialize();
    logger.info("Audio backend initialized", { browser: context.platform.browser });

    // 2. Set up the theme manager and load the default theme
    this.themeManager = new ThemeManager();

    // Use chrome.runtime.getURL directly (not browser.runtime.getURL) because
    // WXT's browser.runtime.getURL has strict PublicPath typing that rejects
    // dynamic asset paths. The chrome global is available on both Chrome and
    // Firefox via WXT's polyfill.
    const getURL = (path: string): string => chrome.runtime.getURL(path);

    // Load all built-in themes from the theme registry
    for (const theme of BUILT_IN_THEMES) {
      try {
        const themeUrl = getURL(`${theme.path}/theme.json`);
        const response = await fetch(themeUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} loading theme: ${themeUrl}`);
        }
        const manifest = await response.json();

        const basePath = getURL(theme.path);
        const result = this.themeManager.loadTheme(theme.id, manifest, basePath);

        if (result.success) {
          logger.info(`Theme loaded: ${theme.id}`);
        } else {
          logger.error(`Failed to validate ${theme.id} theme`, { errors: result.errors });
        }
      } catch (error) {
        logger.error(
          `Failed to load ${theme.id} theme`,
          error instanceof Error ? error : undefined,
        );
      }
    }

    // Set active theme from user settings (falls back to config default)
    const activeTheme =
      (await context.settings.get<string>("general.activeTheme")) ?? DEFAULT_THEME_ID;
    this.themeManager.setActiveTheme(activeTheme);

    // 3. Wire the event engine to the browser APIs
    const browserGlobal =
      typeof browser !== "undefined"
        ? (browser as unknown as Record<string, unknown>)
        : ((globalThis as Record<string, unknown>).chrome as Record<string, unknown>);

    this.eventEngine = new EventEngine(browserGlobal, context.messageBus, logger);

    // Register listeners for ALL events on this platform. The runtime
    // handler (handleBrowserEvent) checks per-event enabled state from
    // user settings, so listeners must exist for Tier 2/3 events that
    // the user may enable at runtime without requiring a restart.
    this.eventEngine.registerAll(EVENT_REGISTRY, context.platform.browser);
    logger.info("Event engine ready", { registeredEvents: EVENT_REGISTRY.length });

    this.unsubscribe = null;
  }

  /**
   * Subscribe to browser-event messages and start playing sounds.
   * Reads masterVolume from settings and applies it to the audio backend.
   * @throws Error if the module has not been initialized.
   */
  async activate(): Promise<void> {
    if (!this.context || !this.backend) {
      throw new Error("Module not initialized.");
    }
    const { logger, messageBus, settings } = this.context;

    // Subscribe to browser-event messages from the event engine
    this.unsubscribe = messageBus.subscribe(BROWSER_EVENT_CHANNEL, (data: unknown) => {
      const message = data as BrowserEventMessage;
      this.handleBrowserEvent(message).catch((error: unknown) => {
        logger.error("Failed to handle browser event", error instanceof Error ? error : undefined);
      });
    });

    // Set global volume from settings
    const masterVolume = (await settings.get<number>("general.masterVolume")) ?? 80;
    await this.backend.setGlobalVolume(masterVolume / 100);

    // Watch for live settings changes (mute, volume, theme)
    this.unwatchers.push(
      settings.watch("general.masterVolume", (newValue) => {
        const vol = (newValue as number) ?? 80;
        this.backend?.setGlobalVolume(vol / 100);
        logger.debug(`Volume changed to ${vol}%`);
      }),
      settings.watch("general.muted", (newValue) => {
        const muted = (newValue as boolean) ?? false;
        if (muted) this.backend?.stopAll();
        logger.debug(muted ? "Muted" : "Unmuted");
      }),
      settings.watch("general.activeTheme", (newValue) => {
        const themeId = (newValue as string) ?? DEFAULT_THEME_ID;
        if (this.themeManager) {
          this.themeManager.setActiveTheme(themeId);
          logger.info(`Theme switched to ${themeId}`);
        }
      }),
    );

    logger.info("Sound engine activated");
  }

  /** Unsubscribe from browser-event messages and stop all playing sounds. */
  async deactivate(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    for (const unwatch of this.unwatchers) unwatch();
    this.unwatchers = [];

    await this.backend?.stopAll();
    this.context?.logger.info("Sound engine deactivated");
  }

  /** Dispose event engine and audio backend, releasing all resources. */
  async dispose(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    for (const unwatch of this.unwatchers) unwatch();
    this.unwatchers = [];

    this.eventEngine?.dispose();
    await this.backend?.dispose();
    this.context?.logger.info("Sound engine disposed");
  }

  /**
   * Handle a browser event by resolving and playing the appropriate sound.
   */
  private async handleBrowserEvent(message: BrowserEventMessage): Promise<void> {
    if (!this.context || !this.backend || !this.themeManager) return;
    const { logger, settings } = this.context;

    // Check if muted
    const muted = (await settings.get<boolean>("general.muted")) ?? false;
    if (muted) return;

    // Find the event definition to get its tier
    const eventDef = EVENT_REGISTRY.find((e) => e.id === message.eventId);
    if (!eventDef) {
      logger.warn("Unknown event ID in message", { eventId: message.eventId });
      return;
    }

    // Check per-event enabled setting: user override → config default
    const eventConfig = await settings.get<{
      enabled: boolean;
      volume?: number;
      pitch?: number;
    }>(`sounds.events.${message.eventId}`);
    const isEnabled = eventConfig?.enabled ?? getEventDefaults(message.eventId).enabled;
    if (!isEnabled) return;

    // Resolve which sound to play (uses isError field from registry, not string matching)
    const soundUrl = this.themeManager.resolveSound(
      message.eventId,
      eventDef.tier,
      eventDef.isError ?? false,
    );

    if (!soundUrl) {
      logger.debug("No sound mapped for event", { eventId: message.eventId });
      return;
    }

    // Play the sound with per-event overrides
    const result = await this.backend.play(soundUrl, {
      volume: eventConfig?.volume !== undefined ? eventConfig.volume / 100 : undefined,
      rate: eventConfig?.pitch,
    });

    // Log the result with the event label in the message for readability
    if (result.success) {
      logger.info(`${eventDef.label} sound played (${result.latencyMs}ms)`, {
        eventId: message.eventId,
        sound: soundUrl,
      });
    } else {
      logger.warn(`${eventDef.label} sound failed: ${result.error}`, {
        eventId: message.eventId,
        sound: soundUrl,
      });
    }
  }
}

/** Singleton instance of the sound engine module. */
export const soundEngineModule = new SoundEngineModule();
