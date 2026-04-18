/// <reference types="chrome" />

// Pulls the `chrome` namespace from @types/chrome into the global scope.
// Required as of TypeScript 6, which no longer auto-includes ambient types
// from every @types/* package — only those referenced explicitly.
// The extension calls `chrome.runtime.getURL(...)` directly in a few spots
// because WXT's `browser.runtime.getURL` has a too-strict PublicPath type
// that rejects dynamic asset paths. The `chrome` global is available on
// both Chrome and Firefox via WXT's polyfill.
