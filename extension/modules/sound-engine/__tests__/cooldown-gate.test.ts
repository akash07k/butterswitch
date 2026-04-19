import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CooldownGate } from "../cooldown-gate.js";
import type { Logger } from "@butterswitch/logger";

/**
 * Returns a logger whose every level method is a vi.fn() spy. The cooldown
 * gate emits debug() entries with structured suppression-reason data; tests
 * assert against `logger.debug.mock.calls` to confirm the right reason and
 * payload were logged.
 */
function createMockLogger(): Logger & { debug: ReturnType<typeof vi.fn> } {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: () => createMockLogger(),
    addTransport: vi.fn(),
    flush: async () => {},
    dispose: async () => {},
  } as Logger & { debug: ReturnType<typeof vi.fn> };
}

describe("CooldownGate", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
    // Use fake timers so we can advance Date.now() deterministically.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("global cooldown", () => {
    it("allows the first event through", () => {
      const gate = new CooldownGate({ globalCooldownMs: 150 }, logger);
      expect(gate.tryEnter("first.event")).toBe(true);
    });

    it("blocks subsequent events within the cooldown window", () => {
      const gate = new CooldownGate({ globalCooldownMs: 150 }, logger);
      expect(gate.tryEnter("a")).toBe(true);
      gate.markPlayed("a");

      vi.advanceTimersByTime(50);
      expect(gate.tryEnter("b")).toBe(false);
    });

    it("allows events after the cooldown expires", () => {
      const gate = new CooldownGate({ globalCooldownMs: 150 }, logger);
      gate.markPlayed("a");

      vi.advanceTimersByTime(150);
      expect(gate.tryEnter("b")).toBe(true);
    });

    it("does NOT update the cooldown when tryEnter returns true (no markPlayed)", () => {
      // Regression coverage for the "disabled events poison the cooldown"
      // bug — calling tryEnter alone must not reserve the window.
      const gate = new CooldownGate({ globalCooldownMs: 150 }, logger);
      expect(gate.tryEnter("a")).toBe(true);
      // Note: NOT calling markPlayed here.

      // Even immediately after, a different event should still be allowed.
      expect(gate.tryEnter("b")).toBe(true);
    });

    it("logs structured suppression metadata when blocking", () => {
      const gate = new CooldownGate({ globalCooldownMs: 150 }, logger);
      gate.markPlayed("first");

      vi.advanceTimersByTime(40);
      gate.tryEnter("second");

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Suppressed by global cooldown: second"),
        expect.objectContaining({
          suppression: "globalCooldown",
          eventId: "second",
          msSinceLastFire: 40,
          cooldownMs: 150,
          msRemaining: 110,
          previousEventId: "first",
        }),
      );
    });

    it("disabled with globalCooldownMs: 0 — never blocks", () => {
      const gate = new CooldownGate({ globalCooldownMs: 0 }, logger);
      gate.markPlayed("a");
      expect(gate.tryEnter("b")).toBe(true);
      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe("per-event debounce", () => {
    it("blocks the same event id within the debounce window", () => {
      const gate = new CooldownGate({ globalCooldownMs: 0 }, logger);
      gate.markPlayed("noisy.event");

      vi.advanceTimersByTime(100);
      expect(gate.tryEnter("noisy.event", 300)).toBe(false);
    });

    it("does not block a different event id within the debounce window", () => {
      const gate = new CooldownGate({ globalCooldownMs: 0 }, logger);
      gate.markPlayed("noisy.event");

      vi.advanceTimersByTime(100);
      expect(gate.tryEnter("other.event", 300)).toBe(true);
    });

    it("allows the same event id after the debounce expires", () => {
      const gate = new CooldownGate({ globalCooldownMs: 0 }, logger);
      gate.markPlayed("noisy.event");

      vi.advanceTimersByTime(300);
      expect(gate.tryEnter("noisy.event", 300)).toBe(true);
    });

    it("logs structured debounce metadata", () => {
      const gate = new CooldownGate({ globalCooldownMs: 0 }, logger);
      gate.markPlayed("e");

      vi.advanceTimersByTime(50);
      gate.tryEnter("e", 200);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Suppressed by debounce: e"),
        expect.objectContaining({
          suppression: "debounce",
          eventId: "e",
          msSinceLastFire: 50,
          debounceMs: 200,
        }),
      );
    });

    it("no debounce check when debounceMs is undefined or 0", () => {
      const gate = new CooldownGate({ globalCooldownMs: 0 }, logger);
      gate.markPlayed("e");
      expect(gate.tryEnter("e")).toBe(true);
      expect(gate.tryEnter("e", 0)).toBe(true);
    });
  });

  describe("interaction", () => {
    it("global cooldown takes precedence over debounce", () => {
      const gate = new CooldownGate({ globalCooldownMs: 150 }, logger);
      gate.markPlayed("a");

      vi.advanceTimersByTime(50);
      // Both gates would block 'a', but the global cooldown is checked first
      // and is what gets logged.
      gate.tryEnter("a", 300);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Suppressed by global cooldown"),
        expect.objectContaining({ suppression: "globalCooldown" }),
      );
      expect(logger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("Suppressed by debounce"),
        expect.anything(),
      );
    });
  });

  describe("reset", () => {
    it("clears all timestamps", () => {
      const gate = new CooldownGate({ globalCooldownMs: 150 }, logger);
      gate.markPlayed("a");

      vi.advanceTimersByTime(10);
      expect(gate.tryEnter("b")).toBe(false);

      gate.reset();
      expect(gate.tryEnter("b")).toBe(true);
      expect(gate.tryEnter("a", 300)).toBe(true);
    });
  });
});
