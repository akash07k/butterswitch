/**
 * @module platform/url
 *
 * Cross-browser wrapper for `runtime.getURL` that accepts dynamic
 * paths. WXT types `browser.runtime.getURL` as a strict `PublicPath`
 * template union, which rejects any string built from a runtime value
 * (theme-resolved sound files, query-string variants, etc.). Code
 * that builds asset URLs from data should call {@link getAssetURL}
 * instead of using `chrome.runtime.getURL` or casting `PublicPath`
 * inline.
 */

/**
 * Resolve a runtime asset path to its full extension URL.
 *
 * Wraps the cross-browser `runtime.getURL` and accepts any string so
 * dynamic paths (for example, theme-resolved sound files) compile
 * without WXT's `PublicPath` strictness. The `as never` cast bypasses
 * that template type for runtime-built paths; literal entrypoint
 * paths should call `browser.runtime.getURL` directly so the typed
 * union still catches typos at compile time.
 *
 * @param path - Asset path relative to the extension root
 *   (for example `sounds/pulse/tab-created.ogg`).
 * @returns The fully-qualified `chrome-extension://...` /
 *   `moz-extension://...` URL for the asset.
 */
export function getAssetURL(path: string): string {
  return browser.runtime.getURL(path as never);
}
