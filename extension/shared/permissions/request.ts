/**
 * @module permissions/request
 *
 * Runtime permission helper for permissions declared as
 * `optional_permissions` in the manifest. Optional permissions are
 * not granted at install time — the extension has to ask for them
 * the first time a feature that needs them is enabled.
 *
 * The set in {@link OPTIONAL_PERMISSIONS} mirrors the manifest. Tier 2
 * events whose `permissions` field overlaps that set must run through
 * {@link requestPermissions} before their listener can fire. The static
 * `permissions` list in `wxt.config.ts` covers everything else.
 */

/**
 * Permissions the extension declares under `optional_permissions`
 * instead of the static `permissions` list. Used by the Sound Events
 * tab to decide whether toggling on a Tier 2 event needs a runtime
 * permission prompt.
 *
 * Keep this in sync with `wxt.config.ts` — the manifest is the source
 * of truth, this set is the consumer-side mirror.
 */
export const OPTIONAL_PERMISSIONS = new Set<string>(["management", "cookies", "history"]);

/**
 * Filter an arbitrary permission list down to the ones declared as
 * optional in the manifest. Anything else (static permissions like
 * `tabs`, `webNavigation`) is granted at install time and should not
 * be asked for again.
 *
 * @param perms - Raw permission list, typically from an event
 *   registry entry's `permissions` field.
 * @returns The subset that needs a runtime grant before use.
 */
export function pickOptionalPermissions(perms: readonly string[]): string[] {
  return perms.filter((p) => OPTIONAL_PERMISSIONS.has(p));
}

/**
 * Request optional permissions at runtime. Returns true if the
 * permissions are granted (either already, or after the user accepted
 * the prompt), false if the user denied the prompt or the request
 * threw. Safe to call when the permissions are already granted —
 * `permissions.contains` short-circuits the prompt in that case.
 *
 * Must be called from a user gesture (e.g., a click handler) on
 * Chromium browsers, otherwise the prompt is suppressed and the
 * promise resolves to false.
 *
 * @param perms - The permission descriptor (e.g. `{ permissions: ["cookies"] }`).
 * @returns A promise resolving to whether the permissions are now granted.
 */
export async function requestPermissions(perms: chrome.permissions.Permissions): Promise<boolean> {
  try {
    const already = await browser.permissions.contains(perms);
    if (already) return true;
    return await browser.permissions.request(perms);
  } catch {
    return false;
  }
}
