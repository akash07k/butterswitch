import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

/**
 * WXT configuration for the ButterSwitch browser extension.
 *
 * WXT uses file-based entrypoints — each file in entrypoints/ becomes
 * a background script, popup, options page, content script, etc.
 * based on its name and export.
 *
 * Tailwind CSS is added via the Vite plugin since WXT manages Vite
 * internally (there's no separate vite.config.ts).
 *
 * @see https://wxt.dev/api/config.html
 */
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "ButterSwitch",
    description: "Smooth as butter, with every feature just a switch away.",
    permissions: [
      "tabs",
      "bookmarks",
      "downloads",
      "webNavigation",
      "storage",
      "notifications",
      "idle",
      "history",
      "management",
      "cookies",
      "offscreen", // Chrome-only; Firefox ignores unknown permissions
    ],
    commands: {
      "toggle-mute": {
        suggested_key: { default: "Alt+M" },
        description: "Toggle sound mute on/off",
      },
      "open-options": {
        suggested_key: { default: "Alt+Shift+O" },
        description: "Open ButterSwitch options page",
      },
    },
    browser_specific_settings: {
      gecko: {
        id: "butterswitch@example.com",
        strict_min_version: "109.0",
      },
    },
    web_accessible_resources: [
      {
        resources: ["sounds/**/*"],
        matches: ["<all_urls>"],
      },
    ],
  },
});
