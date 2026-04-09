/**
 * @module offscreen/main
 *
 * Offscreen document audio player for Chrome MV3.
 *
 * Chrome's service workers have no DOM, so they can't use the Web Audio
 * API or <audio> elements. This offscreen document provides that capability.
 *
 * It receives messages from the service worker (via chrome.runtime.onMessage),
 * plays sounds using Howler.js, and reports results back.
 *
 * Lifecycle: Chrome may terminate this document after inactivity.
 * The ChromeAudioBackend handles lazy recreation when needed.
 */

import { Howl, Howler } from "howler";
import type {
  AudioMessage,
  AudioResponse,
} from "../../modules/sound-engine/audio-backends/types.js";

/** Cache of loaded Howl instances to avoid re-creating for repeated sounds. */
const soundCache = new Map<string, Howl>();

/**
 * Listen for messages from the service worker.
 * Each message type maps to a specific audio action.
 */
chrome.runtime.onMessage.addListener(
  (message: AudioMessage, _sender, sendResponse: (response: AudioResponse) => void) => {
    switch (message.type) {
      case "PLAY_SOUND":
        handlePlaySound(message.url, message.options)
          .then((response) => sendResponse(response))
          .catch(() =>
            sendResponse({
              type: "SOUND_PLAYED",
              success: false,
              latencyMs: 0,
              error: "Unknown error",
            }),
          );
        // Return true to indicate we'll respond asynchronously
        return true;

      case "STOP_ALL":
        Howler.stop();
        sendResponse({ type: "STOPPED" });
        return false;

      case "SET_VOLUME":
        Howler.volume(message.volume);
        sendResponse({ type: "VOLUME_SET" });
        return false;
    }
  },
);

/**
 * Play a sound using Howler.js.
 *
 * Uses a cache to avoid re-loading the same sound file repeatedly.
 * If `interrupt` is set, stops the cached instance before replaying.
 *
 * @param url - URL of the sound file to play.
 * @param options - Volume, rate, and interrupt options.
 * @returns Play result with success status and latency.
 */
async function handlePlaySound(
  url: string,
  options: AudioMessage extends { type: "PLAY_SOUND"; options: infer O } ? O : never,
): Promise<AudioResponse> {
  const startTime = performance.now();

  return new Promise<AudioResponse>((resolve) => {
    try {
      let sound = soundCache.get(url);

      // Create a new Howl if not cached
      if (!sound) {
        sound = new Howl({
          src: [url],
          preload: true,
          html5: false, // Use Web Audio API for better performance
        });
        soundCache.set(url, sound);
      }

      // Stop existing playback if interrupt is requested
      if (options.interrupt) {
        sound.stop();
      }

      // Apply per-play options
      const playId = sound.play();

      if (options.volume !== undefined) {
        sound.volume(options.volume, playId);
      }
      if (options.rate !== undefined) {
        sound.rate(options.rate, playId);
      }

      // Resolve on play start (not on end — we want latency, not duration)
      sound.once("play", () => {
        const latencyMs = Math.round(performance.now() - startTime);
        resolve({ type: "SOUND_PLAYED", success: true, latencyMs });
      });

      // Handle load errors
      sound.once("loaderror", (_id, error) => {
        const latencyMs = Math.round(performance.now() - startTime);
        resolve({
          type: "SOUND_PLAYED",
          success: false,
          latencyMs,
          error: `Load error: ${String(error)}`,
        });
      });

      // Handle play errors
      sound.once("playerror", (_id, error) => {
        const latencyMs = Math.round(performance.now() - startTime);
        resolve({
          type: "SOUND_PLAYED",
          success: false,
          latencyMs,
          error: `Play error: ${String(error)}`,
        });
      });
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      resolve({
        type: "SOUND_PLAYED",
        success: false,
        latencyMs,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
