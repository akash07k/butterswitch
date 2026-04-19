/**
 * @module sound-engine/cooldown-gate
 *
 * Two-stage suppression gate that decides whether an event should be
 * allowed to play a sound right now: a global cooldown (debounce across
 * all events) and a per-event debounce (suppress same-event spam).
 *
 * The gate is decoupled from "what just happened" tracking via two
 * methods: `tryEnter()` checks both gates without mutating state, and
 * `markPlayed()` is called only AFTER a sound actually played. This
 * separation prevents disabled or failed-to-play events from poisoning
 * the cooldown window for subsequent enabled events.
 */

import type { Logger } from "@butterswitch/logger";

/** Tunable thresholds for the gate. */
export interface CooldownGateConfig {
  /**
   * Global suppression window in milliseconds. After any sound plays,
   * all subsequent events are suppressed for this duration. Set to 0
   * to disable the global gate.
   */
  globalCooldownMs: number;
}

/**
 * Tracks the last-played event globally and per-event so the gate can
 * suppress cascading or repeating sounds. State is mutated only via
 * `markPlayed()` — never as a side effect of `tryEnter()`.
 */
export class CooldownGate {
  /** Wall-clock time of the most recent successful play. */
  private lastGlobalFireTime = 0;

  /**
   * Event id that owned the most recent successful play. Recorded so
   * suppression logs can identify which event "won" the current window.
   */
  private lastGlobalFiredEventId: string | null = null;

  /** Per-event id → timestamp of last successful play, for debounce. */
  private readonly lastFireTime = new Map<string, number>();

  /**
   * @param config - Tunable cooldown thresholds.
   * @param logger - Logger for emitting suppression-reason debug entries.
   */
  constructor(
    private readonly config: CooldownGateConfig,
    private readonly logger: Logger,
  ) {}

  /**
   * Check whether an event is allowed to play right now. Logs a
   * structured suppression entry at debug level if the answer is no.
   *
   * Does NOT mutate state — call `markPlayed()` after the sound has
   * actually played. This keeps disabled events and failed plays from
   * consuming the cooldown window.
   *
   * @param eventId - Event identifier (used for logging).
   * @param debounceMs - Optional per-event debounce window. Omit for none.
   * @returns true if the event may proceed, false if it should be suppressed.
   */
  tryEnter(eventId: string, debounceMs?: number): boolean {
    const now = Date.now();

    if (this.config.globalCooldownMs > 0) {
      const msSinceLastFire = now - this.lastGlobalFireTime;
      if (msSinceLastFire < this.config.globalCooldownMs) {
        this.logger.debug(`Suppressed by global cooldown: ${eventId}`, {
          suppression: "globalCooldown",
          eventId,
          msSinceLastFire,
          cooldownMs: this.config.globalCooldownMs,
          msRemaining: this.config.globalCooldownMs - msSinceLastFire,
          previousEventId: this.lastGlobalFiredEventId,
        });
        return false;
      }
    }

    if (debounceMs && debounceMs > 0) {
      const lastFire = this.lastFireTime.get(eventId) ?? 0;
      const msSinceLastFire = now - lastFire;
      if (msSinceLastFire < debounceMs) {
        this.logger.debug(`Suppressed by debounce: ${eventId}`, {
          suppression: "debounce",
          eventId,
          msSinceLastFire,
          debounceMs,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Record that a sound actually played for the given event. Updates
   * both the global cooldown and the per-event debounce timestamps.
   * Call this only after the audio backend confirms a successful play.
   *
   * @param eventId - Event identifier whose sound just played.
   */
  markPlayed(eventId: string): void {
    const now = Date.now();
    if (this.config.globalCooldownMs > 0) {
      this.lastGlobalFireTime = now;
      this.lastGlobalFiredEventId = eventId;
    }
    this.lastFireTime.set(eventId, now);
  }

  /** Clear all recorded fire times. Used on dispose. */
  reset(): void {
    this.lastGlobalFireTime = 0;
    this.lastGlobalFiredEventId = null;
    this.lastFireTime.clear();
  }
}
