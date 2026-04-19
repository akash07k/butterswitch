/**
 * @module sound-engine/cooldown-gate
 *
 * Two-stage suppression gate that decides whether an event should be
 * allowed to play a sound right now: a global cooldown (debounce across
 * all events) and a per-event debounce (suppress same-event spam).
 *
 * `tryEnter()` is **atomic** — it checks both gates and, if the event is
 * allowed through, commits the cooldown timestamp synchronously in the
 * same call, before any `await`. This is essential under JS concurrency:
 * `SoundEngineModule.handleBrowserEvent()` is async, and several
 * invocations can race through the gate in microsecond-scale windows
 * (e.g., when Ctrl+T fires onCreated + onActivated + onBeforeNavigate
 * all within ~5 ms). A split "check then commit later" API would let
 * every concurrent invocation pass; an atomic check-and-set lets only
 * the first one through.
 *
 * The gate is INSULATED from the "disabled events poison the cooldown"
 * problem by ordering inside the caller: `handleBrowserEvent` checks
 * the per-event enabled setting BEFORE calling `tryEnter`. Disabled
 * events therefore never reach the gate at all.
 *
 * Trade-off: a failed audio play (rare — backend error) still consumes
 * the cooldown window for its 150 ms duration, since the timestamp is
 * committed before play() resolves. Acceptable, because the next event
 * would have been suppressed by the cooldown regardless.
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
 * suppress cascading or repeating sounds. State is mutated only inside
 * `tryEnter()` on the success branch — never as a separate side-effect.
 */
export class CooldownGate {
  /** Wall-clock time of the most recently committed fire. */
  private lastGlobalFireTime = 0;

  /**
   * Event id that owned the most recent committed fire. Recorded so
   * suppression logs can identify which event "won" the current window.
   */
  private lastGlobalFiredEventId: string | null = null;

  /** Per-event id → timestamp of last committed fire, for debounce. */
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
   * Atomic check-and-commit. If the event is allowed through, the
   * cooldown timestamp is updated synchronously before this method
   * returns. If the event is suppressed, a structured debug-level
   * suppression entry is logged and no state changes.
   *
   * Concurrent callers race only at the JS-engine level; because this
   * method has no `await`, the JS event loop guarantees the check-
   * and-set pair is observed atomically by every other caller.
   *
   * @param eventId - Event identifier.
   * @param debounceMs - Optional per-event debounce window. Omit for none.
   * @returns true if the event was admitted (and the gate updated),
   *          false if it was suppressed.
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

    // Admitted — commit the cooldown timestamp atomically with the decision.
    if (this.config.globalCooldownMs > 0) {
      this.lastGlobalFireTime = now;
      this.lastGlobalFiredEventId = eventId;
    }
    this.lastFireTime.set(eventId, now);
    return true;
  }

  /** Clear all recorded fire times. Used on dispose. */
  reset(): void {
    this.lastGlobalFireTime = 0;
    this.lastGlobalFiredEventId = null;
    this.lastFireTime.clear();
  }
}
