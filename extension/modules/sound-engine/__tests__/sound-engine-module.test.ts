/**
 * End-to-end integration tests for {@link SoundEngineModule}.
 *
 * Publishes events directly on the message bus (bypassing the browser
 * API event-engine wiring) and asserts the downstream audio backend
 * was or was not invoked. This is the only coverage for the interplay
 * between the mute cache, per-event enabled cache, cooldown gate, and
 * theme resolution — each part is unit-tested in isolation elsewhere,
 * but they compose here.
 *
 * What these tests intentionally don't exercise:
 * - EventEngine listener registration (covered by event-engine.test.ts)
 * - CooldownGate internals (covered by cooldown-gate.test.ts)
 * - ThemeManager resolution order (covered by theme-manager.test.ts)
 * - browser.storage.local backing (InMemorySettingsStore used instead)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SoundEngineModule } from "../index.js";
import { BROWSER_EVENT_CHANNEL, type BrowserEventMessage } from "../event-engine.js";
import { MessageBusImpl } from "../../../core/message-bus/bus.js";
import { InMemorySettingsStore } from "../../../core/settings/store.js";
import type { AudioBackend, PlayResult } from "../audio-backends/types.js";
import type { ModuleContext, PlatformInfo } from "../../../core/module-system/types.js";
import type { Logger } from "@butterswitch/logger";

type LoggerMock = Logger & { debug: ReturnType<typeof vi.fn> };

/**
 * A self-referential logger mock. `child()` returns `this` so nested
 * child() calls in production code don't cause infinite mock creation.
 * Every level is a spy so tests can assert on messages when useful.
 */
function createLoggerMock(): LoggerMock {
  const mock = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: () => mock,
    addTransport: vi.fn(),
    flush: async () => {},
    dispose: async () => {},
  };
  return mock as unknown as LoggerMock;
}

/** Tracks every sound URL passed to play() so tests can assert on it. */
function createBackendMock(): AudioBackend & { plays: string[] } {
  const plays: string[] = [];
  return {
    plays,
    initialize: vi.fn(async () => {}),
    play: vi.fn(async (url: string): Promise<PlayResult> => {
      plays.push(url);
      return { success: true, latencyMs: 1 };
    }),
    stopAll: vi.fn(async () => {}),
    setGlobalVolume: vi.fn(async () => {}),
    isReady: () => true,
    dispose: vi.fn(async () => {}),
  };
}

/** Minimal theme manifest covering the events the tests fire. */
const TEST_THEME_MANIFEST = {
  name: "Test",
  description: "Integration test theme",
  author: "Test",
  version: "1.0.0",
  mappings: {
    "tabs.onCreated": "tab-created.ogg",
    "webNavigation.onBeforeNavigate": "nav-starting.ogg",
    "webNavigation.onCompleted": "page-loaded.ogg",
    "webNavigation.onErrorOccurred": "nav-error.ogg",
  },
  fallbacks: {
    tier1: "generic-info.ogg",
    error: "generic-error.ogg",
  },
};

const PLATFORM: PlatformInfo = {
  browser: "chrome",
  manifestVersion: 3,
  browserVersion: "140",
  os: "linux",
};

/** Build a BrowserEventMessage the way the event-engine would. */
function makeMessage(
  eventId: string,
  extractedData: Record<string, unknown> = {},
): BrowserEventMessage {
  return {
    eventId,
    extractedData,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Flush pending microtasks so the async handleBrowserEvent chain
 * (mute check → enabled check → tryEnter → resolveSound → await
 * backend.play → log) settles. Two microtask hops are enough for the
 * current pipeline; ten is generous padding against future additions.
 */
async function drainMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe("SoundEngineModule integration", () => {
  let backend: ReturnType<typeof createBackendMock>;
  let logger: LoggerMock;
  let messageBus: MessageBusImpl;
  let settings: InMemorySettingsStore;
  let context: ModuleContext;
  let module: SoundEngineModule;

  beforeEach(() => {
    // Stub chrome.runtime.getURL for ThemeManager + Module internals.
    // Also stub namespaces so EventEngine.registerAll can index into
    // them without crashing; it still warns and skips most events
    // because no real browser API is present.
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
    };

    // ThemeManager fetches theme.json from the extension URL; mock to
    // return our compact test manifest rather than loading from disk.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => TEST_THEME_MANIFEST,
          }) as unknown as Response,
      ),
    );

    backend = createBackendMock();
    logger = createLoggerMock();
    messageBus = new MessageBusImpl();
    settings = new InMemorySettingsStore({
      "general.muted": false,
      "general.masterVolume": 80,
      "general.activeTheme": "pulse",
    });
    context = { logger, messageBus, settings, platform: PLATFORM };
    module = new SoundEngineModule();
    module.setAudioBackend(backend);
  });

  afterEach(async () => {
    await module.dispose();
    vi.unstubAllGlobals();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("plays the mapped sound when an enabled event fires", async () => {
    await module.initialize(context);
    await module.activate();

    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("tabs.onCreated"));
    await drainMicrotasks();

    expect(backend.plays).toHaveLength(1);
    expect(backend.plays[0]).toContain("tab-created.ogg");
  });

  it("respects the muted setting — no sound plays when muted", async () => {
    await settings.set("general.muted", true);
    await module.initialize(context);
    await module.activate();

    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("tabs.onCreated"));
    await drainMicrotasks();

    expect(backend.plays).toHaveLength(0);
  });

  it("respects a user-disabled event config — no sound plays", async () => {
    // tabs.onCreated is Tier 1 and default-enabled. User override: off.
    await settings.set("sounds.events.tabs.onCreated", { enabled: false });
    await module.initialize(context);
    await module.activate();

    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("tabs.onCreated"));
    await drainMicrotasks();

    expect(backend.plays).toHaveLength(0);
  });

  it("reacts to a live mute toggle — cache updates via settings.watch", async () => {
    // Regression coverage for the cache refactor: toggling
    // mute after activate() must be observed by the hot path without a
    // re-activate.
    await module.initialize(context);
    await module.activate();

    // First fire: unmuted, sound plays.
    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("tabs.onCreated"));
    await drainMicrotasks();
    expect(backend.plays).toHaveLength(1);

    // Toggle mute → cache watcher updates this.muted.
    await settings.set("general.muted", true);

    // Second fire: muted, no sound.
    messageBus.publish(
      BROWSER_EVENT_CHANNEL,
      makeMessage("webNavigation.onBeforeNavigate", { url: "https://example.com" }),
    );
    await drainMicrotasks();
    expect(backend.plays).toHaveLength(1);
  });

  it("reacts to a live per-event disable — config cache invalidation works", async () => {
    // Regression coverage for `newValue === undefined` not applicable
    // here (we're setting a config, not deleting it), but we still
    // exercise the on-change branch of the per-event watcher.
    await module.initialize(context);
    await module.activate();

    // First fire: enabled by default, plays.
    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("tabs.onCreated"));
    await drainMicrotasks();
    expect(backend.plays).toHaveLength(1);

    // Disable via settings.set — watcher updates eventConfigs cache.
    await settings.set("sounds.events.tabs.onCreated", { enabled: false });

    // Second fire: disabled, no new play.
    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("tabs.onCreated"));
    await drainMicrotasks();
    expect(backend.plays).toHaveLength(1);
  });

  it("plays nothing for an unknown event id (but does not throw)", async () => {
    await module.initialize(context);
    await module.activate();

    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("not.a.real.event"));
    await drainMicrotasks();

    expect(backend.plays).toHaveLength(0);
    // The module should have warned. Useful to confirm the warn log
    // fires so operators can spot stray events.
    expect(logger.warn).toHaveBeenCalled();
  });

  it("applies per-event volume and pitch overrides to the play call", async () => {
    await settings.set("sounds.events.tabs.onCreated", {
      enabled: true,
      volume: 50, // stored as percentage in settings
      pitch: 1.5,
    });
    await module.initialize(context);
    await module.activate();

    messageBus.publish(BROWSER_EVENT_CHANNEL, makeMessage("tabs.onCreated"));
    await drainMicrotasks();

    expect(backend.play).toHaveBeenCalledWith(
      expect.stringContaining("tab-created.ogg"),
      // handleBrowserEvent divides the percentage by 100 before passing
      // to the backend; 50% → 0.5
      expect.objectContaining({ volume: 0.5, rate: 1.5 }),
    );
  });
});
