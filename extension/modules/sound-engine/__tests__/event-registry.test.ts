import { describe, it, expect } from "vitest";
import { EVENT_REGISTRY, TIER_1_COUNT, TIER_2_COUNT, TIER_3_COUNT } from "../event-registry.js";
import { getEventDefaults } from "../../../config/events.js";

describe("EVENT_REGISTRY", () => {
  it("has events defined", () => {
    expect(EVENT_REGISTRY.length).toBeGreaterThan(0);
  });

  it("tier counts add up to total", () => {
    expect(TIER_1_COUNT + TIER_2_COUNT + TIER_3_COUNT).toBe(EVENT_REGISTRY.length);
  });

  it("all events have unique IDs", () => {
    const ids = EVENT_REGISTRY.map((e) => e.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all events have required fields", () => {
    for (const event of EVENT_REGISTRY) {
      expect(event.id, `${event.id}: id`).toBeTruthy();
      expect(event.namespace, `${event.id}: namespace`).toBeTruthy();
      expect(event.event, `${event.id}: event`).toBeTruthy();
      expect(event.label, `${event.id}: label`).toBeTruthy();
      expect(event.description, `${event.id}: description`).toBeTruthy();
      expect([1, 2, 3], `${event.id}: tier`).toContain(event.tier);
      expect(event.platforms.length, `${event.id}: platforms`).toBeGreaterThan(0);
    }
  });

  it("tier 1 events are enabled by default in config", () => {
    const tier1 = EVENT_REGISTRY.filter((e) => e.tier === 1);

    for (const event of tier1) {
      expect(getEventDefaults(event.id).enabled, `${event.id} should be enabled by default`).toBe(
        true,
      );
    }
  });

  it("tier 2 and 3 events are disabled by default in config", () => {
    const nonTier1 = EVENT_REGISTRY.filter((e) => e.tier !== 1);

    for (const event of nonTier1) {
      expect(getEventDefaults(event.id).enabled, `${event.id} should be disabled by default`).toBe(
        false,
      );
    }
  });

  it("sub-events have filter functions", () => {
    const subEvents = EVENT_REGISTRY.filter((e) => e.id.split(".").length > 2);

    for (const event of subEvents) {
      expect(event.filter, `${event.id} should have a filter function`).toBeDefined();
    }
  });

  it("all platforms are valid", () => {
    for (const event of EVENT_REGISTRY) {
      for (const platform of event.platforms) {
        expect(["chrome", "firefox"], `${event.id}: invalid platform ${platform}`).toContain(
          platform,
        );
      }
    }
  });
});
