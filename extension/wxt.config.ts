import { defineConfig } from "wxt";

/**
 * WXT configuration for the ButterSwitch browser extension.
 *
 * WXT uses file-based entrypoints — each file in entrypoints/ becomes
 * a background script, popup, options page, content script, etc.
 * based on its name and export.
 *
 * @see https://wxt.dev/api/config.html
 */
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
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
    ],
  },
});
