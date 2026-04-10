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
import { ChromeAudioBackend } from "../modules/sound-engine/audio-backends/chrome-backend.js";
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

      // 5. Inject the audio backend before registering the module.
      //    Chrome: uses ChromeAudioBackend (offscreen document, no Howler in SW).
      //    Firefox: will use FirefoxAudioBackend (built separately via wxt build -b firefox).
      //    NOTE: Firefox backend is NOT imported here to keep Howler.js out of
      //    Chrome's service worker bundle. Firefox builds will have a separate
      //    background entry or dynamic loading strategy.
      soundEngineModule.setAudioBackend(new ChromeAudioBackend());

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

      // 8. Try to connect WebSocket transport after startup
      //    Done after a delay to avoid ERR_CONNECTION_REFUSED at startup.
      //    If the log server isn't running, this silently skips.
      setTimeout(() => connectLogServer(logger), 2000);

      // 9. Listen for messages from popup/options page
      setupMessageListener(logger);
    } catch (error) {
      logger.fatal("ButterSwitch failed to start", error instanceof Error ? error : undefined);
    }
  }

  /**
   * Attempts to add a WebSocket transport to the logger for
   * streaming logs to the accessible log viewer.
   *
   * Reads the URL from browser.storage.local. Only connects if
   * the server is reachable. Silently skips if not.
   * Called on a delay after startup and whenever the URL setting changes.
   */
  async function connectLogServer(logger: Logger): Promise<void> {
    try {
      const stored = await browser.storage.local.get("general.logServerUrl");
      const url =
        (stored["general.logServerUrl"] as string) || DEFAULT_SETTINGS.general.logServerUrl;

      // Add the WebSocket transport — it auto-reconnects with exponential backoff,
      // so even if the server isn't running now, it'll connect when it starts.
      const wsTransport = new WebSocketTransport({ url });

      // Access the internal transports array to add dynamically.
      // The Logger interface doesn't expose this, but we know it's there.
      const loggerAny = logger as unknown as { transports: unknown[] };
      if (Array.isArray(loggerAny.transports)) {
        loggerAny.transports.push(wsTransport);
        logger.info("WebSocket log transport added", { url });
      }
    } catch {
      // Silently skip — log server not configured or not reachable
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

        if (msg.type === "PREVIEW_SOUND") {
          // Preview handled by the offscreen document's onMessage listener.
          // We don't need to intercept it here — let it pass through.
          return false;
        }

        // Unknown message type — don't respond (might be for offscreen document)
        return false;
      },
    );
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

  // Start the bootstrap process.
  // Cannot use top-level await in a service worker, so we
  // call the async function and catch errors.
  bootstrap().catch((error) => {
    console.error("[ButterSwitch] Fatal bootstrap error:", error);
  });
});
