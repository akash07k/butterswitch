/**
 * @module sound-engine/audio-backends/firefox-backend
 *
 * Firefox audio backend using Howler.js directly in the background context.
 *
 * Unlike Chrome, Firefox MV3 extensions can use a persistent background
 * page with DOM access. This means Howler.js runs directly here — no
 * offscreen document or message passing needed.
 *
 * Delegates all Howler.js logic to the shared HowlerPlayer to avoid
 * code duplication with the Chrome offscreen document.
 */

import type { AudioBackend, PlayOptions, PlayResult } from "./types.js";
import { HowlerPlayer } from "./howler-player.js";

/**
 * Firefox audio backend that plays sounds directly via Howler.js.
 *
 * Simpler than Chrome's offscreen approach because the background
 * page has full DOM access. Uses HowlerPlayer for the actual
 * Howler.js interaction (shared with the offscreen document).
 *
 * @example
 * ```ts
 * const backend = new FirefoxAudioBackend();
 * await backend.initialize();
 * const result = await backend.play("sounds/tab-created.ogg", { volume: 0.8 });
 * ```
 */
export class FirefoxAudioBackend implements AudioBackend {
  private readonly player = new HowlerPlayer();
  private initialized = false;

  /**
   * Initialize the backend.
   * For Firefox, this is a no-op — the background page is already available.
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async play(soundUrl: string, options: PlayOptions = {}): Promise<PlayResult> {
    return this.player.play(soundUrl, options);
  }

  async stopAll(): Promise<void> {
    this.player.stopAll();
  }

  async setGlobalVolume(volume: number): Promise<void> {
    this.player.setGlobalVolume(volume);
  }

  isReady(): boolean {
    return this.initialized;
  }

  async dispose(): Promise<void> {
    this.player.dispose();
    this.initialized = false;
  }
}
