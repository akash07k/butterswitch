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
import { ChromeAudioBackend } from "./audio-backends/chrome-backend.js";
import { FirefoxAudioBackend } from "./audio-backends/firefox-backend.js";
import { EventEngine, BROWSER_EVENT_CHANNEL, type BrowserEventMessage } from "./event-engine.js";
import { ThemeManager } from "./theme-manager.js";
import { EVENT_REGISTRY } from "./event-registry.js";

/** Module ID used for registration and dependency references. */
export const SOUND_ENGINE_MODULE_ID = "sound-engine";

/**
 * Sound engine module — implements ButterSwitchModule.
 *
 * Lifecycle:
 * - **initialize**: Select audio backend, load default theme, wire event listeners
 * - **activate**: Subscribe to browser-event messages and start playing sounds
 * - **deactivate**: Unsubscribe from messages, stop all sounds
 * - **dispose**: Release audio backend and all resources
 */
export const soundEngineModule: ButterSwitchModule = {
  id: SOUND_ENGINE_MODULE_ID,
  name: "Sound Engine",
  version: "1.0.0",

  // -- Internal state (set during initialize) --
  /** @internal */ _context: undefined as unknown as ModuleContext,
  /** @internal */ _backend: undefined as unknown as AudioBackend,
  /** @internal */ _eventEngine: undefined as unknown as EventEngine,
  /** @internal */ _themeManager: undefined as unknown as ThemeManager,
  /** @internal */ _unsubscribe: undefined as unknown as (() => void) | null,

  async initialize(context: ModuleContext): Promise<void> {
    this._context = context;
    const logger = context.logger;

    // 1. Select the right audio backend based on platform
    logger.info("Selecting audio backend", { browser: context.platform.browser });
    this._backend =
      context.platform.browser === "firefox" ? new FirefoxAudioBackend() : new ChromeAudioBackend();

    await this._backend.initialize();
    logger.info("Audio backend initialized");

    // 2. Set up the theme manager
    this._themeManager = new ThemeManager();

    // Load the default "subtle" theme
    // In a full implementation, this would load the theme.json from assets
    // For now, the theme is loaded by the caller or during first activation
    logger.info("Theme manager ready");

    // 3. Wire the event engine to the browser APIs
    // The `browser` global is provided by WXT at runtime
    const browserGlobal =
      typeof browser !== "undefined"
        ? (browser as unknown as Record<string, unknown>)
        : ((globalThis as Record<string, unknown>).chrome as Record<string, unknown>);

    this._eventEngine = new EventEngine(browserGlobal, context.messageBus, logger);

    // Register listeners for all events supported on this platform
    const enabledEvents = EVENT_REGISTRY.filter((e) => e.defaultEnabled);
    this._eventEngine.registerAll(enabledEvents, context.platform.browser);
    logger.info("Event engine ready", { registeredEvents: enabledEvents.length });

    this._unsubscribe = null;
  },

  async activate(): Promise<void> {
    const logger = this._context.logger;

    // Subscribe to browser-event messages from the event engine
    this._unsubscribe = this._context.messageBus.subscribe(
      BROWSER_EVENT_CHANNEL,
      (data: unknown) => {
        const message = data as BrowserEventMessage;
        this.handleBrowserEvent(message).catch((error) => {
          logger.error(
            "Failed to handle browser event",
            error instanceof Error ? error : undefined,
          );
        });
      },
    );

    // Set global volume from settings
    const masterVolume = (await this._context.settings.get<number>("general.masterVolume")) ?? 80;
    await this._backend.setGlobalVolume(masterVolume / 100);

    logger.info("Sound engine activated");
  },

  async deactivate(): Promise<void> {
    // Unsubscribe from browser events
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    // Stop all playing sounds
    await this._backend.stopAll();

    this._context.logger.info("Sound engine deactivated");
  },

  async dispose(): Promise<void> {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    await this._backend.dispose();
    this._context.logger.info("Sound engine disposed");
  },

  /**
   * Handle a browser event by resolving and playing the appropriate sound.
   *
   * @internal
   * @param message - The browser event message from the event engine.
   */
  async handleBrowserEvent(message: BrowserEventMessage): Promise<void> {
    const logger = this._context.logger;

    // Check if muted
    const muted = (await this._context.settings.get<boolean>("general.muted")) ?? false;
    if (muted) return;

    // Find the event definition to get its tier
    const eventDef = EVENT_REGISTRY.find((e) => e.id === message.eventId);
    if (!eventDef) {
      logger.warn("Unknown event ID in message", { eventId: message.eventId });
      return;
    }

    // Check per-event enabled setting
    const eventConfig = await this._context.settings.get<{
      enabled: boolean;
      volume?: number;
      pitch?: number;
    }>(`sounds.events.${message.eventId}`);
    if (eventConfig && !eventConfig.enabled) return;

    // Determine if this is an error event
    const isError =
      message.eventId.includes("error") ||
      message.eventId.includes("Error") ||
      message.eventId.includes("failed");

    // Resolve which sound to play
    const soundUrl = this._themeManager.resolveSound(message.eventId, eventDef.tier, isError);

    if (!soundUrl) {
      logger.debug("No sound mapped for event", { eventId: message.eventId });
      return;
    }

    // Play the sound with per-event overrides
    const result = await this._backend.play(soundUrl, {
      volume: eventConfig?.volume !== undefined ? eventConfig.volume / 100 : undefined,
      rate: eventConfig?.pitch,
    });

    // Log the result
    logger.debug("Sound played", {
      eventId: message.eventId,
      sound: soundUrl,
      success: result.success,
      latencyMs: result.latencyMs,
      error: result.error,
    });
  },
} as ButterSwitchModule & Record<string, unknown>;
