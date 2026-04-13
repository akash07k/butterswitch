/**
 * @module offscreen/main
 *
 * Offscreen document audio player for Chrome MV3.
 *
 * Chrome's service workers have no DOM, so they can't use the Web Audio
 * API or <audio> elements. This offscreen document provides that capability.
 *
 * It receives messages from the service worker (via chrome.runtime.onMessage),
 * delegates to the shared HowlerPlayer, and reports results back.
 *
 * Lifecycle: Chrome may terminate this document after inactivity.
 * The ChromeAudioBackend handles lazy recreation when needed.
 */

import type {
  AudioMessage,
  AudioResponse,
} from "../../modules/sound-engine/audio-backends/types.js";
import { HowlerPlayer } from "../../modules/sound-engine/audio-backends/howler-player.js";

/** Single shared player instance for this offscreen document. */
const player = new HowlerPlayer();

/**
 * Listen for messages from the service worker.
 * Each message type maps to a specific audio action.
 */
chrome.runtime.onMessage.addListener(
  (message: AudioMessage, _sender, sendResponse: (response: AudioResponse) => void) => {
    switch (message.type) {
      case "PLAY_SOUND":
        player
          .play(message.url, message.options)
          .then((result) =>
            sendResponse({
              type: "SOUND_PLAYED",
              success: result.success,
              latencyMs: result.latencyMs,
              error: result.error,
            }),
          )
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
        player.stopAll();
        sendResponse({ type: "STOPPED" });
        return false;

      case "SET_VOLUME":
        player.setGlobalVolume(message.volume);
        sendResponse({ type: "VOLUME_SET" });
        return false;
    }
  },
);
