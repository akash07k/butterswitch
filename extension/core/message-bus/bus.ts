/**
 * @module message-bus/bus
 *
 * Pub/sub message bus for inter-module communication.
 *
 * Modules never import each other directly — they communicate by
 * publishing and subscribing to named channels. This decoupling
 * means adding or removing a module never breaks other modules.
 *
 * Handler errors are caught and logged to prevent one bad subscriber
 * from breaking the entire channel.
 */

import type { MessageBus } from "../module-system/types.js";

/** Type for a message handler function. */
type Handler = (data: unknown) => void;

/**
 * In-memory pub/sub message bus.
 *
 * Implements the {@link MessageBus} interface used by
 * modules via their {@link ModuleContext}.
 *
 * @example
 * ```ts
 * const bus = new MessageBusImpl();
 *
 * // Module A subscribes
 * const unsub = bus.subscribe("browser-event", (data) => {
 *   console.log("Event received:", data);
 * });
 *
 * // Module B publishes
 * bus.publish("browser-event", { type: "tabs.onCreated", tabId: 42 });
 *
 * // Cleanup
 * unsub();
 * ```
 */
export class MessageBusImpl implements MessageBus {
  /**
   * Map of channel name → list of handler functions.
   * Each channel maintains its own ordered list of subscribers.
   */
  private readonly channels = new Map<string, Handler[]>();

  /**
   * Publish a message to all subscribers of a channel.
   *
   * Handlers are iterated over a SNAPSHOT of the subscriber list, so a
   * handler that unsubscribes itself or another handler mid-iteration
   * cannot cause a later handler to be skipped. Without this snapshot,
   * the live array would shift down on `splice()` and the `for…of`
   * indexed walk would miss the next handler.
   *
   * If a handler throws, the error is caught so remaining handlers
   * still execute. Errors are logged to `console.error` as a fallback
   * — the project's structured logger may itself be a subscriber, and
   * routing handler errors through it would risk recursive failures.
   *
   * @param channel - The channel name to publish to.
   * @param data - The message payload (any JSON-serializable value).
   */
  publish(channel: string, data: unknown): void {
    const handlers = this.channels.get(channel);
    if (!handlers || handlers.length === 0) return;

    // Snapshot before iteration — see method docstring for why.
    const snapshot = handlers.slice();

    for (const handler of snapshot) {
      try {
        handler(data);
      } catch (error) {
        console.error(`[MessageBus] Handler error on channel "${channel}":`, error);
      }
    }
  }

  /**
   * Subscribe to a channel. The handler is called each time
   * a message is published to that channel.
   *
   * Returns an unsubscribe function — call it to stop receiving messages.
   *
   * @param channel - The channel name to subscribe to.
   * @param handler - Function called with the message data.
   * @returns An unsubscribe function.
   */
  subscribe(channel: string, handler: Handler): () => void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, []);
    }

    const handlers = this.channels.get(channel)!;
    handlers.push(handler);

    // Return an unsubscribe function that removes this specific handler
    return () => {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    };
  }
}
