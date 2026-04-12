/**
 * @module background
 *
 * ButterSwitch service worker — the extension's entry point.
 *
 * This is where the module system boots up. On extension load:
 * 1. Creates the logger with Console + WebSocket transports
 * 2. Detects the platform (Chrome/Firefox, OS)
 * 3. Creates the module registry, message bus, and settings store
 * 4. Registers the sound engine module
 * 5. Initializes all modules in dependency order
 * 6. Activates enabled modules
 *
 * WXT's defineBackground() is the entry point. The main function
 * CANNOT be async (MV3 constraint), so we call the async bootstrap
 * function inside it and handle errors.
 */

import { createLogger, LogLevel, ConsoleTransport, WebSocketTransport } from "@butterswitch/logger";
import type { Logger } from "@butterswitch/logger";
import { ModuleRegistry } from "../core/module-system/registry.js";
import { ModuleLoader } from "../core/module-system/loader.js";
import { MessageBusImpl } from "../core/message-bus/bus.js";
import { BrowserSettingsStore } from "../core/settings/browser-store.js";
import { DEFAULT_SETTINGS } from "../core/settings/defaults.js";
import { detectPlatform } from "../shared/platform/detect.js";
import { soundEngineModule } from "../modules/sound-engine/index.js";
import type { AudioBackend } from "../modules/sound-engine/audio-backends/types.js";
import type { ModuleContext } from "../core/module-system/types.js";

export default defineBackground(() => {
  /**
   * Bootstrap the extension — create all services and start modules.
   * Called from the synchronous defineBackground main function.
   */
  async function bootstrap(): Promise<void> {
    // 1. Create the logger
    //    Console transport only by default. WebSocket transport can be
    //    enabled later via the options page when the user starts the log server.
    //    We don't attempt WebSocket here because Chrome logs ANY failed
    //    WebSocket connection as an extension error — even caught ones.
    const logger = createLogger({
      level: LogLevel.DEBUG,
      tag: "butterswitch",
      transports: [new ConsoleTransport()],
    });

    logger.info("ButterSwitch starting up...");

    try {
      // 2. Detect the platform
      const platform = await detectPlatform();
      logger.info("Platform detected", {
        browser: platform.browser,
        os: platform.os,
        version: platform.browserVersion,
      });

      // 3. Create shared services
      const messageBus = new MessageBusImpl();
      const settings = createSettingsStore();

      // 4. Build the module context — shared by all modules
      const context: ModuleContext = {
        logger,
        messageBus,
        settings,
        platform,
      };

      // 5. Inject the platform-specific audio backend before registering.
      //    Chrome: offscreen document (service workers have no DOM).
      //    Firefox: Howler.js directly in background page (has DOM access).
      //    Dynamic import keeps Howler.js out of Chrome's service worker bundle —
      //    Vite tree-shakes the unused branch at build time via import.meta.env.BROWSER.
      const audioBackend = await createAudioBackend();
      soundEngineModule.setAudioBackend(audioBackend);

      const registry = new ModuleRegistry();
      registry.register(soundEngineModule);
      logger.info("Modules registered", { count: registry.getIds().length });

      // 6. Initialize all modules in dependency order
      const loader = new ModuleLoader(registry, context);
      await loader.initializeAll();
      logger.info("Modules initialized");

      // 7. Activate enabled modules
      const enabledModules = DEFAULT_SETTINGS.general.enabledModules;
      for (const moduleId of enabledModules) {
        const entry = registry.get(moduleId);
        if (entry && entry.state === "initialized") {
          try {
            await loader.activate(moduleId);
            logger.info(`Module activated: ${moduleId}`);
          } catch (error) {
            logger.error(
              `Failed to activate module: ${moduleId}`,
              error instanceof Error ? error : undefined,
            );
          }
        }
      }

      logger.info("ButterSwitch ready", {
        activeModules: enabledModules.length,
        platform: platform.browser,
      });

      // 8. Connect WebSocket log transport ONLY if user has enabled it.
      //    The setting "general.logStreamEnabled" persists across restarts.
      //    Default is false — no connection, no Chrome errors.
      //    Users who want log streaming enable it once in the Logging tab.
      const logStreamEnabled = (await browser.storage.local.get("general.logStreamEnabled"))[
        "general.logStreamEnabled"
      ];
      if (logStreamEnabled) {
        connectLogServer(logger);
      }

      // 10. Clean up on service worker suspension
      browser.runtime.onSuspend.addListener(() => {
        logger.info("Service worker suspending — disposing modules");
        loader.disposeAll().catch(console.error);
      });

      // 9. Listen for messages from popup/options page
      setupMessageListener(logger);
    } catch (error) {
      logger.fatal("ButterSwitch failed to start", error instanceof Error ? error : undefined);
    }
  }

  /**
   * Adds a WebSocket transport to the logger for streaming logs
   * to the accessible log viewer.
   *
   * Only called when the user has enabled log streaming in settings.
   * The WebSocket transport auto-reconnects with exponential backoff,
   * so if the server is not running yet, it will connect when it starts.
   *
   * NOTE: Creating a WebSocket that fails WILL show as a Chrome
   * extension error. This is acceptable because the user explicitly
   * opted in by enabling log streaming.
   */
  async function connectLogServer(logger: Logger): Promise<void> {
    try {
      const stored = await browser.storage.local.get("general.logServerUrl");
      const wsUrl =
        (stored["general.logServerUrl"] as string) || DEFAULT_SETTINGS.general.logServerUrl;

      const wsTransport = new WebSocketTransport({ url: wsUrl });
      logger.addTransport(wsTransport);
      logger.info("WebSocket log transport connected", { url: wsUrl });
    } catch {
      // Silently skip
    }
  }

  /**
   * Listens for messages from popup/options page contexts.
   * Routes LOG messages to the logger and handles other message types.
   */
  function setupMessageListener(logger: Logger): void {
    browser.runtime.onMessage.addListener(
      (message: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
        const msg = message as { type?: string };

        if (msg.type === "LOG") {
          const logMsg = message as {
            level: string;
            message: string;
            data?: Record<string, unknown>;
          };
          const uiLogger = logger.child({ tag: "ui" });
          switch (logMsg.level) {
            case "debug":
              uiLogger.debug(logMsg.message, logMsg.data);
              break;
            case "info":
              uiLogger.info(logMsg.message, logMsg.data);
              break;
            case "warn":
              uiLogger.warn(logMsg.message, logMsg.data);
              break;
            case "error":
              uiLogger.error(logMsg.message, logMsg.data);
              break;
            case "fatal":
              uiLogger.fatal(logMsg.message, logMsg.data);
              break;
          }
          sendResponse({ success: true });
          return false;
        }

        if (msg.type === "CONNECT_LOG_SERVER") {
          connectLogServer(logger).then(() => sendResponse({ success: true }));
          return true; // async response
        }

        if (msg.type === "PREVIEW_SOUND") {
          const previewMsg = message as { eventId: string };
          handlePreviewSound(previewMsg.eventId, logger)
            .then((result) => sendResponse(result))
            .catch(() => sendResponse({ success: false, error: "Preview failed" }));
          return true; // async response
        }

        // Unknown message type — don't respond (might be for offscreen document)
        return false;
      },
    );
  }

  /**
   * Handle a sound preview request from the options page.
   * Resolves the sound for the given event and plays it through the audio backend.
   */
  async function handlePreviewSound(
    eventId: string,
    logger: Logger,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const themeManager = soundEngineModule.getThemeManager();
      const backend = soundEngineModule.getBackend();

      if (!themeManager || !backend) {
        return { success: false, error: "Sound engine not initialized" };
      }

      const { EVENT_REGISTRY } = await import("../modules/sound-engine/event-registry.js");
      const eventDef = EVENT_REGISTRY.find((e) => e.id === eventId);
      if (!eventDef) {
        return { success: false, error: `Unknown event: ${eventId}` };
      }

      const soundUrl = themeManager.resolveSound(eventId, eventDef.tier, eventDef.isError ?? false);

      if (!soundUrl) {
        return { success: false, error: "No sound mapped for this event" };
      }

      const result = await backend.play(soundUrl);
      logger.info(`Preview: ${eventDef.label}`, { eventId, sound: soundUrl });
      return { success: result.success, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Creates the settings store backed by browser.storage.local.
   *
   * Flattens the nested DEFAULT_SETTINGS into dot-notation keys used
   * as fallback values when a setting hasn't been explicitly set yet.
   * Reads/writes go to browser.storage.local for persistence.
   */
  function createSettingsStore(): BrowserSettingsStore {
    const flatDefaults: Record<string, unknown> = {};

    // Flatten general settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS.general)) {
      flatDefaults[`general.${key}`] = value;
    }

    // Flatten sound event settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS.sounds.events)) {
      flatDefaults[`sounds.events.${key}`] = value;
    }

    // Flatten theme settings
    flatDefaults["themes.customThemes"] = DEFAULT_SETTINGS.themes.customThemes;

    // Flatten hotkey settings
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS.hotkeys.bindings)) {
      flatDefaults[`hotkeys.bindings.${key}`] = value;
    }

    return new BrowserSettingsStore(flatDefaults);
  }

  /**
   * Creates the platform-specific audio backend.
   *
   * Uses dynamic imports so Vite tree-shakes the unused backend at build time:
   * - Chrome build: only ChromeAudioBackend is bundled (no Howler.js in SW)
   * - Firefox build: only FirefoxAudioBackend is bundled (Howler.js in background page)
   */
  async function createAudioBackend(): Promise<AudioBackend> {
    if (import.meta.env.BROWSER === "firefox") {
      const { FirefoxAudioBackend } =
        await import("../modules/sound-engine/audio-backends/firefox-backend.js");
      return new FirefoxAudioBackend();
    }

    const { ChromeAudioBackend } =
      await import("../modules/sound-engine/audio-backends/chrome-backend.js");
    return new ChromeAudioBackend();
  }

  // Start the bootstrap process.
  // Cannot use top-level await in a service worker, so we
  // call the async function and catch errors.
  bootstrap().catch((error) => {
    console.error("[ButterSwitch] Fatal bootstrap error:", error);
  });
});
