import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectPlatform } from "../detect.js";

/**
 * Platform detection depends on browser extension APIs (chrome.runtime, navigator).
 * We mock these globals for testing since Vitest runs in Node.js.
 */

describe("detectPlatform", () => {
  const originalNavigator = globalThis.navigator;
  const originalChrome = (globalThis as Record<string, unknown>).chrome;

  beforeEach(() => {
    // Reset mocks before each test
    (globalThis as Record<string, unknown>).chrome = undefined;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", { value: originalNavigator, writable: true });
    (globalThis as Record<string, unknown>).chrome = originalChrome;
  });

  it("detects Chrome when chrome.runtime exists without getBrowserInfo", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: {
        getManifest: () => ({ manifest_version: 3 }),
      },
    };
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Chrome/120.0.0.0", platform: "Win32" },
      writable: true,
    });

    const info = await detectPlatform();

    expect(info.browser).toBe("chrome");
    expect(info.manifestVersion).toBe(3);
    expect(info.os).toBe("win");
  });

  it("detects Firefox when browser.runtime.getBrowserInfo exists", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: {
        getManifest: () => ({ manifest_version: 3 }),
        getBrowserInfo: async () => ({ name: "Firefox", version: "121.0" }),
      },
    };
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Firefox/121.0", platform: "Win32" },
      writable: true,
    });

    const info = await detectPlatform();

    expect(info.browser).toBe("firefox");
  });

  it("detects Windows OS", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: { getManifest: () => ({ manifest_version: 3 }) },
    };
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Chrome/120", platform: "Win32" },
      writable: true,
    });

    const info = await detectPlatform();
    expect(info.os).toBe("win");
  });

  it("detects macOS", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: { getManifest: () => ({ manifest_version: 3 }) },
    };
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Chrome/120", platform: "MacIntel" },
      writable: true,
    });

    const info = await detectPlatform();
    expect(info.os).toBe("mac");
  });

  it("detects Linux", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: { getManifest: () => ({ manifest_version: 3 }) },
    };
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Chrome/120", platform: "Linux x86_64" },
      writable: true,
    });

    const info = await detectPlatform();
    expect(info.os).toBe("linux");
  });

  it("extracts browser version from user agent", async () => {
    (globalThis as Record<string, unknown>).chrome = {
      runtime: { getManifest: () => ({ manifest_version: 3 }) },
    };
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Mozilla/5.0 Chrome/120.0.6099.130", platform: "Win32" },
      writable: true,
    });

    const info = await detectPlatform();
    expect(info.browserVersion).toBe("120.0.6099.130");
  });
});
