/**
 * @module messaging/types
 *
 * Message types for communication between extension contexts.
 *
 * The popup and options page run in separate contexts from the
 * background script. They communicate via browser.runtime.sendMessage().
 * This file defines the message protocol so all contexts use
 * consistent, typed messages.
 */

/**
 * Messages that UI contexts (popup, options) can send to the background script.
 */
export type ExtensionMessage = LogMessage | PreviewSoundMessage;

/**
 * Request the background script to log a message.
 * Used by popup/options since they don't have direct logger access.
 */
export interface LogMessage {
  type: "LOG";
  level: "debug" | "info" | "warn" | "error" | "fatal";
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Request the background script to preview a sound for an event.
 * Used by the Sound Events tab's preview button.
 */
export interface PreviewSoundMessage {
  type: "PREVIEW_SOUND";
  eventId: string;
}

/**
 * Response from the background script.
 */
export interface ExtensionResponse {
  success: boolean;
  error?: string;
}
