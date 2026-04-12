/**
 * @module sound-engine/audio-backends/chrome-backend
 *
 * Chrome MV3 audio backend using an offscreen document.
 *
 * Chrome's service workers have no DOM, so audio playback requires
 * an offscreen document — a hidden HTML page that Chrome creates on
 * demand. This backend manages the offscreen document lifecycle and
 * communicates with it via chrome.runtime.sendMessage.
 *
 * Key behavior: **lazy recreation**. Chrome may terminate the offscreen
 * document after inactivity. Before each play(), we check hasDocument()
 * and recreate if needed. A mutex prevents race conditions when
 * multiple events fire simultaneously after a long idle.
 */

import type {
  AudioBackend,
  PlayOptions,
  PlayResult,
  AudioMessage,
  AudioResponse,
} from "./types.js";

/**
 * Path to the offscreen document HTML file (relative to extension root).
 * WXT flattens entrypoint paths: entrypoints/offscreen/index.html → offscreen.html
 */
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

/**
 * Chrome audio backend that delegates playback to an offscreen document.
 *
 * @example
 * ```ts
 * const backend = new ChromeAudioBackend();
 * await backend.initialize();
 * const result = await backend.play("sounds/tab-created.ogg", { volume: 0.8 });
 * ```
 */
export class ChromeAudioBackend implements AudioBackend {
  /** Whether the backend has been initialized at least once. */
  private initialized = false;

  /**
   * Promise for in-progress offscreen document creation.
   * All concurrent callers await the same promise — no race conditions.
   */
  private creatingPromise: Promise<void> | null = null;

  /**
   * Initialize the backend by ensuring the offscreen document exists.
   */
  async initialize(): Promise<void> {
    await this.ensureOffscreenDocument();
    this.initialized = true;
  }

  /**
   * Play a sound via the offscreen document.
   *
   * Checks if the offscreen document exists before each play
   * (lazy recreation). If it was terminated by Chrome, it's
   * recreated transparently with ~50-100ms latency.
   */
  async play(soundUrl: string, options: PlayOptions = {}): Promise<PlayResult> {
    await this.ensureOffscreenDocument();

    const message: AudioMessage = {
      type: "PLAY_SOUND",
      url: soundUrl,
      options,
    };

    try {
      const response = await this.sendMessage(message);
      if (response.type === "SOUND_PLAYED") {
        return {
          success: response.success,
          latencyMs: response.latencyMs,
          error: response.error,
        };
      }
      return { success: false, latencyMs: 0, error: "Unexpected response type" };
    } catch (error) {
      return {
        success: false,
        latencyMs: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stop all playing sounds via the offscreen document.
   */
  async stopAll(): Promise<void> {
    try {
      await this.sendMessage({ type: "STOP_ALL" });
    } catch {
      // Offscreen document might not exist — that's OK, nothing is playing
    }
  }

  /**
   * Set the global volume via the offscreen document.
   */
  async setGlobalVolume(volume: number): Promise<void> {
    try {
      await this.sendMessage({ type: "SET_VOLUME", volume });
    } catch {
      // Offscreen document might not exist — volume will be set on next create
    }
  }

  /**
   * Whether the backend is ready to play sounds.
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Dispose the offscreen document.
   */
  async dispose(): Promise<void> {
    try {
      if (await this.hasDocument()) {
        await chrome.offscreen.closeDocument();
      }
    } catch {
      // Already closed or never created
    }
    this.initialized = false;
  }

  /**
   * Ensures the offscreen document exists, creating it if needed.
   *
   * The `creatingPromise` check is BEFORE the async `hasDocument()` call
   * to prevent a race where two concurrent callers both pass hasDocument()
   * and both attempt createDocument(). All concurrent callers await the
   * same creation promise.
   */
  private async ensureOffscreenDocument(): Promise<void> {
    // If creation is already in progress, all callers await the same promise.
    // This check is synchronous — no async gap before the guard.
    if (this.creatingPromise) {
      await this.creatingPromise;
      return;
    }

    if (await this.hasDocument()) return;

    this.creatingPromise = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "ButterSwitch needs to play audio cues for browser events.",
      })
      .finally(() => {
        this.creatingPromise = null;
      });

    await this.creatingPromise;
  }

  /**
   * Checks if the offscreen document currently exists.
   * This is a near-zero-cost check — the common fast path.
   */
  private async hasDocument(): Promise<boolean> {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
      });
      return contexts.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Send a message to the offscreen document and await a response.
   */
  private sendMessage(message: AudioMessage): Promise<AudioResponse> {
    return chrome.runtime.sendMessage(message);
  }
}
