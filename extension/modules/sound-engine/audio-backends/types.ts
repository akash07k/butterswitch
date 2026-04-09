/**
 * @module sound-engine/audio-backends/types
 *
 * Platform-agnostic interface for audio playback.
 *
 * Chrome and Firefox implement this differently:
 * - Chrome: offscreen document with Howler.js (service workers have no DOM)
 * - Firefox: background page with Howler.js
 *
 * The sound engine uses this interface without knowing which
 * platform it's running on — the correct backend is selected
 * during module initialization based on PlatformInfo.
 */

/**
 * Options for playing a single sound.
 */
export interface PlayOptions {
  /** Volume override for this play (0.0 to 1.0). Uses global volume if omitted. */
  volume?: number;

  /** Playback rate / pitch (0.5 to 4.0, default 1.0). */
  rate?: number;

  /** Whether to stop the same sound if it's already playing. */
  interrupt?: boolean;
}

/**
 * Result of a play operation.
 * Used for logging and diagnostics.
 */
export interface PlayResult {
  /** Whether playback succeeded. */
  success: boolean;

  /** Time in milliseconds from play request to audio starting. */
  latencyMs: number;

  /** Error message if playback failed. */
  error?: string;
}

/**
 * Platform-agnostic audio playback interface.
 *
 * Each platform (Chrome, Firefox) provides its own implementation.
 * The sound engine module calls these methods without knowing
 * which backend is behind them.
 *
 * @example
 * ```ts
 * // In the sound engine module:
 * const backend: AudioBackend = createAudioBackend(platform);
 * await backend.initialize();
 * await backend.play("sounds/tab-created.ogg", { volume: 0.8 });
 * ```
 */
export interface AudioBackend {
  /**
   * Initialize the audio backend.
   *
   * Chrome: creates/ensures the offscreen document exists.
   * Firefox: sets up the background page audio context.
   *
   * Must be called before any play() calls.
   */
  initialize(): Promise<void>;

  /**
   * Play a sound file with the given options.
   *
   * @param soundUrl - URL of the sound file (relative to extension root).
   * @param options - Volume, rate, and interrupt options.
   * @returns Result with success status and latency.
   */
  play(soundUrl: string, options?: PlayOptions): Promise<PlayResult>;

  /**
   * Stop all currently playing sounds.
   * Used when the user toggles mute or switches themes.
   */
  stopAll(): Promise<void>;

  /**
   * Set the global volume for all sounds.
   *
   * @param volume - Volume level from 0.0 (silent) to 1.0 (full).
   */
  setGlobalVolume(volume: number): Promise<void>;

  /**
   * Check if the backend is ready to play sounds.
   * Returns false if initialization hasn't completed or failed.
   */
  isReady(): boolean;

  /**
   * Clean up all resources (audio contexts, offscreen documents, etc.).
   * Called when the sound engine module is disposed.
   */
  dispose(): Promise<void>;
}

/**
 * Message types used for communication between the service worker
 * and the audio playback context (offscreen document or background page).
 *
 * Both Chrome and Firefox use the same message protocol,
 * so the sound engine's code is platform-agnostic.
 */
export type AudioMessage =
  | { type: "PLAY_SOUND"; url: string; options: PlayOptions }
  | { type: "STOP_ALL" }
  | { type: "SET_VOLUME"; volume: number };

/**
 * Response from the audio playback context.
 */
export type AudioResponse =
  | { type: "SOUND_PLAYED"; success: boolean; latencyMs: number; error?: string }
  | { type: "STOPPED" }
  | { type: "VOLUME_SET" };
