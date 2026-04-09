/**
 * @module sound-engine/audio-backends/firefox-backend
 *
 * Firefox audio backend using Howler.js directly in the background context.
 *
 * Unlike Chrome, Firefox MV3 extensions can use a persistent background
 * page with DOM access. This means Howler.js runs directly here — no
 * offscreen document or message passing needed.
 *
 * This backend implements the same AudioBackend interface as Chrome's,
 * so the sound engine module doesn't know or care which one it's using.
 */

import { Howl, Howler } from "howler";
import type { AudioBackend, PlayOptions, PlayResult } from "./types.js";

/**
 * Firefox audio backend that plays sounds directly via Howler.js.
 *
 * Simpler than Chrome's offscreen approach because the background
 * page has full DOM access. Sound instances are cached for reuse.
 *
 * @example
 * ```ts
 * const backend = new FirefoxAudioBackend();
 * await backend.initialize();
 * const result = await backend.play("sounds/tab-created.ogg", { volume: 0.8 });
 * ```
 */
export class FirefoxAudioBackend implements AudioBackend {
  /** Cache of loaded Howl instances keyed by sound URL. */
  private readonly soundCache = new Map<string, Howl>();

  /** Whether the backend has been initialized. */
  private initialized = false;

  /**
   * Initialize the backend.
   * For Firefox, this is a no-op — the background page is already available.
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Play a sound using Howler.js.
   *
   * Caches Howl instances for repeated playback of the same sound.
   * If `interrupt` is set, stops the cached instance before replaying.
   */
  async play(soundUrl: string, options: PlayOptions = {}): Promise<PlayResult> {
    const startTime = performance.now();

    try {
      let sound = this.soundCache.get(soundUrl);

      // Create a new Howl if not cached
      if (!sound) {
        sound = new Howl({
          src: [soundUrl],
          preload: true,
          html5: false,
        });
        this.soundCache.set(soundUrl, sound);
      }

      // Stop existing playback if interrupt is requested
      if (options.interrupt) {
        sound.stop();
      }

      return await new Promise<PlayResult>((resolve) => {
        const playId = sound!.play();

        // Apply per-play options
        if (options.volume !== undefined) {
          sound!.volume(options.volume, playId);
        }
        if (options.rate !== undefined) {
          sound!.rate(options.rate, playId);
        }

        // Resolve on play start (not end — we want latency, not duration)
        sound!.once("play", () => {
          const latencyMs = Math.round(performance.now() - startTime);
          resolve({ success: true, latencyMs });
        });

        sound!.once("loaderror", (_id, error) => {
          const latencyMs = Math.round(performance.now() - startTime);
          resolve({ success: false, latencyMs, error: `Load error: ${String(error)}` });
        });

        sound!.once("playerror", (_id, error) => {
          const latencyMs = Math.round(performance.now() - startTime);
          resolve({ success: false, latencyMs, error: `Play error: ${String(error)}` });
        });
      });
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stop all currently playing sounds.
   */
  async stopAll(): Promise<void> {
    Howler.stop();
  }

  /**
   * Set the global volume for all sounds.
   */
  async setGlobalVolume(volume: number): Promise<void> {
    Howler.volume(volume);
  }

  /**
   * Whether the backend is ready to play sounds.
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Dispose all cached sounds and reset state.
   */
  async dispose(): Promise<void> {
    for (const sound of this.soundCache.values()) {
      sound.unload();
    }
    this.soundCache.clear();
    this.initialized = false;
  }
}
