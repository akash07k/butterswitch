import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for the ButterSwitch extension.
 *
 * Tests run in Node.js — browser-specific APIs (like chrome.*)
 * are mocked in individual test files where needed.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ["core/**/__tests__/**/*.test.ts", "shared/**/__tests__/**/*.test.ts"],
  },
});
