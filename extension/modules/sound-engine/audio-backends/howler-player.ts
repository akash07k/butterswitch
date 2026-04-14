/**
 * @module sound-engine/audio-backends/howler-player
 *
 * Shared Howler.js playback logic used by both:
 * - Chrome offscreen document (entrypoints/offscreen/main.ts)
 * - Firefox background page (firefox-backend.ts)
 *
 * Deduplicates the sound cache, play/stop/volume/dispose logic
 * that was previously copy-pasted between both contexts.
 */

import { Howl, Howler } from "howler";
import type { PlayOptions, PlayResult } from "./types.js";

/**
 * Manages a cache of Howl instances and provides play/stop/volume control.
 *
 * Both Chrome (offscreen) and Firefox (background) create one instance.
 * The cache avoids re-loading the same sound file on repeated playback.
 */
export class HowlerPlayer {
  private readonly soundCache = new Map<string, Howl>();

  /**
   * Play a sound with the given options.
   *
   * Creates and caches a Howl instance on first play for each URL.
   * If `interrupt` is set, stops the cached instance before replaying.
   * Resolves on play start (not completion) to measure latency.
   */
  play(soundUrl: string, options: PlayOptions = {}): Promise<PlayResult> {
    const startTime = performance.now();

    return new Promise<PlayResult>((resolve) => {
      try {
        let sound = this.soundCache.get(soundUrl);

        if (!sound) {
          sound = new Howl({
            src: [soundUrl],
            preload: true,
            html5: false,
          });
          this.soundCache.set(soundUrl, sound);
        }

        if (options.interrupt) {
          sound.stop();
        }

        // Register event handlers BEFORE calling play() to avoid a race
        // where cached sounds fire the "play" event synchronously before
        // the handler is attached, causing the promise to never resolve.
        sound.once("play", () => {
          const latencyMs = Math.round(performance.now() - startTime);
          resolve({ success: true, latencyMs });
        });

        sound.once("loaderror", (_id, error) => {
          const latencyMs = Math.round(performance.now() - startTime);
          resolve({ success: false, latencyMs, error: `Load error: ${String(error)}` });
        });

        sound.once("playerror", (_id, error) => {
          const latencyMs = Math.round(performance.now() - startTime);
          resolve({ success: false, latencyMs, error: `Play error: ${String(error)}` });
        });

        const playId = sound.play();

        if (options.volume !== undefined) {
          sound.volume(options.volume, playId);
        }
        if (options.rate !== undefined) {
          sound.rate(options.rate, playId);
        }
      } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        resolve({
          success: false,
          latencyMs,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /** Stop all currently playing sounds. */
  stopAll(): void {
    Howler.stop();
  }

  /** Set the global volume for all sounds (0.0 to 1.0). */
  setGlobalVolume(volume: number): void {
    Howler.volume(volume);
  }

  /** Unload all cached sounds and clear the cache. */
  dispose(): void {
    for (const sound of this.soundCache.values()) {
      sound.unload();
    }
    this.soundCache.clear();
  }
}
