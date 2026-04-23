import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  EVENT_REGISTRY,
  EVENT_REGISTRY_BY_ID,
  TIER_1_COUNT,
  TIER_2_COUNT,
  TIER_3_COUNT,
} from "../event-registry.js";
import { getEventDefaults } from "../../../config/events.js";
import { BUILT_IN_THEMES } from "../../../config/themes.js";

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

  it("EVENT_REGISTRY_BY_ID mirrors EVENT_REGISTRY exactly", () => {
    // Locks the invariant that the O(1) lookup map and the array stay
    // in sync. A definition added to EVENT_REGISTRY without a Map entry
    // (or vice versa) would silently break the hot-path lookup.
    expect(EVENT_REGISTRY_BY_ID.size).toBe(EVENT_REGISTRY.length);
    for (const event of EVENT_REGISTRY) {
      expect(EVENT_REGISTRY_BY_ID.get(event.id), `missing ${event.id}`).toBe(event);
    }
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

  // Contract test guarding against the "default-enabled event silently
  // falls back to generic-info.ogg" class of bug. Two real instances of
  // this shipped before being noticed (tabs.onUpdated.title and
  // downloads.onChanged.resumed) — both fired the generic fallback
  // because their theme mapping was missing. This test fails loudly if
  // any default-enabled event is missing a direct mapping in any
  // shipped built-in theme.
  it("every default-enabled event has a direct mapping in every built-in theme", async () => {
    const defaultEnabled = EVENT_REGISTRY.filter((e) => getEventDefaults(e.id).enabled);

    for (const theme of BUILT_IN_THEMES) {
      // vitest runs from the extension package root, so theme.path
      // ("sounds/pulse") combined with the public/ asset dir gives
      // the on-disk theme.json location.
      const themeJsonPath = resolve(process.cwd(), "public", theme.path, "theme.json");
      const raw = await readFile(themeJsonPath, "utf8");
      const manifest = JSON.parse(raw) as { mappings: Record<string, string> };

      for (const event of defaultEnabled) {
        expect(
          manifest.mappings[event.id],
          `Theme "${theme.id}" is missing a direct sound mapping for default-enabled event "${event.id}". Without a mapping the event silently falls back to the generic-info sound.`,
        ).toBeDefined();
      }
    }
  });
});
