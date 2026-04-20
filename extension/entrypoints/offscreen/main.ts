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
 *
 * NOTE: chrome.runtime.sendMessage broadcasts to ALL listeners in the
 * extension (background + popup + options + this offscreen document).
 * The {@link isAudioMessage} guard rejects non-audio messages at the
 * boundary so they return `false` fast — telling Chrome we will not
 * respond — instead of falling through the switch and silently
 * leaving the sender's promise unresolved.
 */

import type {
  AudioMessage,
  AudioResponse,
} from "../../modules/sound-engine/audio-backends/types.js";
import { HowlerPlayer } from "../../modules/sound-engine/audio-backends/howler-player.js";

/** Single shared player instance for this offscreen document. */
const player = new HowlerPlayer();

/**
 * Type guard rejecting messages that are not for the audio listener.
 * Returning false from the listener tells Chrome "this isn't mine,"
 * allowing other listeners (the background script) to respond instead.
 */
function isAudioMessage(msg: unknown): msg is AudioMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const t = (msg as { type?: unknown }).type;
  return t === "PLAY_SOUND" || t === "STOP_ALL" || t === "SET_VOLUME";
}

/**
 * Listen for messages from the service worker. Each AudioMessage type
 * maps to a specific audio action. Unknown messages are ignored at
 * the boundary; future AudioMessage variants will fail to compile if
 * they aren't added to the switch (the `never` exhaustiveness check
 * in the default arm enforces this).
 */
chrome.runtime.onMessage.addListener(
  (rawMessage: unknown, _sender, sendResponse: (response: AudioResponse) => void) => {
    if (!isAudioMessage(rawMessage)) return false;

    switch (rawMessage.type) {
      case "PLAY_SOUND":
        player
          .play(rawMessage.url, rawMessage.options)
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
        player.setGlobalVolume(rawMessage.volume);
        sendResponse({ type: "VOLUME_SET" });
        return false;

      default: {
        // Compile-time exhaustiveness check — fails to typecheck if a new
        // AudioMessage variant is added without a corresponding case here.
        const exhaustive: never = rawMessage;
        void exhaustive;
        return false;
      }
    }
  },
);
