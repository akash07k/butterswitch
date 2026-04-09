import { describe, it, expect, beforeEach } from "vitest";
import { ThemeManager } from "../theme-manager.js";
import type { ThemeManifest } from "../theme-schema.js";

/** Creates a valid test theme manifest. */
function createTestTheme(overrides?: Partial<ThemeManifest>): ThemeManifest {
  return {
    name: "Test Theme",
    description: "A test theme.",
    author: "Test",
    version: "1.0.0",
    mappings: {
      "tabs.onCreated": "tab-created.ogg",
      "tabs.onRemoved": "tab-closed.ogg",
      "downloads.onChanged.complete": "download-complete.ogg",
    },
    fallbacks: {
      tier1: "generic-info.ogg",
      tier2: "generic-info.ogg",
      tier3: "generic-info.ogg",
      error: "generic-error.ogg",
    },
    ...overrides,
  };
}

describe("ThemeManager", () => {
  let manager: ThemeManager;

  beforeEach(() => {
    manager = new ThemeManager();
  });

  describe("loadTheme", () => {
    it("loads a valid theme", () => {
      const theme = createTestTheme();
      const result = manager.loadTheme("subtle", theme, "/sounds/subtle");

      expect(result.success).toBe(true);
    });

    it("rejects an invalid theme manifest", () => {
      const result = manager.loadTheme("bad", {} as ThemeManifest, "/sounds/bad");

      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("sets the loaded theme as available", () => {
      manager.loadTheme("subtle", createTestTheme(), "/sounds/subtle");

      expect(manager.getAvailableThemes()).toContain("subtle");
    });
  });

  describe("setActiveTheme", () => {
    it("sets the active theme", () => {
      manager.loadTheme("subtle", createTestTheme(), "/sounds/subtle");
      manager.setActiveTheme("subtle");

      expect(manager.getActiveThemeId()).toBe("subtle");
    });

    it("throws for unloaded theme", () => {
      expect(() => manager.setActiveTheme("nonexistent")).toThrow(/not loaded/i);
    });
  });

  describe("resolveSound", () => {
    beforeEach(() => {
      manager.loadTheme("subtle", createTestTheme(), "/sounds/subtle");
      manager.setActiveTheme("subtle");
    });

    it("resolves a directly mapped event to its sound URL", () => {
      const url = manager.resolveSound("tabs.onCreated");

      expect(url).toBe("/sounds/subtle/tab-created.ogg");
    });

    it("resolves another mapped event", () => {
      const url = manager.resolveSound("downloads.onChanged.complete");

      expect(url).toBe("/sounds/subtle/download-complete.ogg");
    });

    it("falls back to tier-based sound for unmapped Tier 1 event", () => {
      const url = manager.resolveSound("bookmarks.onCreated", 1);

      expect(url).toBe("/sounds/subtle/generic-info.ogg");
    });

    it("falls back to tier-based sound for unmapped Tier 2 event", () => {
      const url = manager.resolveSound("history.onVisited", 2);

      expect(url).toBe("/sounds/subtle/generic-info.ogg");
    });

    it("falls back to error sound for error events", () => {
      const url = manager.resolveSound("webNavigation.onErrorOccurred", 1, true);

      expect(url).toBe("/sounds/subtle/generic-error.ogg");
    });

    it("returns null when no mapping or fallback exists", () => {
      const sparseTheme = createTestTheme({ fallbacks: undefined });
      manager.loadTheme("sparse", sparseTheme, "/sounds/sparse");
      manager.setActiveTheme("sparse");

      const url = manager.resolveSound("unmapped.event", 2);

      expect(url).toBeNull();
    });

    it("returns null when no active theme is set", () => {
      const freshManager = new ThemeManager();
      const url = freshManager.resolveSound("tabs.onCreated");

      expect(url).toBeNull();
    });
  });

  describe("getThemeInfo", () => {
    it("returns theme metadata", () => {
      manager.loadTheme("subtle", createTestTheme({ name: "Subtle" }), "/sounds/subtle");

      const info = manager.getThemeInfo("subtle");

      expect(info).toBeDefined();
      expect(info!.name).toBe("Subtle");
      expect(info!.mappingCount).toBe(3);
    });

    it("returns undefined for unknown theme", () => {
      expect(manager.getThemeInfo("unknown")).toBeUndefined();
    });
  });
});
