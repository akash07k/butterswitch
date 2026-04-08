/**
 * @module a11y/focus
 *
 * Focus management utilities for the ButterSwitch extension.
 *
 * These fill gaps that component libraries (Radix, shadcn/ui) don't cover:
 * - Moving focus when a route/tab changes in the options page
 * - Moving focus to a neighbor when the focused element is removed (e.g., filtered out)
 *
 * Focus trapping and restoration for modals/dialogs is handled by
 * Radix Dialog — don't duplicate that here.
 */

/**
 * Selector for elements that can receive keyboard focus.
 * Matches buttons, inputs, selects, textareas, links with href,
 * and elements with explicit tabindex.
 */
const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  'a[href]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Focus the first focusable element within a container.
 *
 * Use this when navigating to a new section/tab in the options page —
 * screen reader users need focus to move to the new content, otherwise
 * they're left on the previous tab button with no indication that
 * content changed.
 *
 * @param container - The DOM element to search within.
 * @returns true if an element was focused, false if none found.
 *
 * @example
 * ```ts
 * // After switching to the "Sound Events" tab:
 * const panel = document.getElementById("sound-events-panel");
 * focusFirst(panel);
 * ```
 */
export function focusFirst(container: HTMLElement): boolean {
  const target = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  if (target) {
    target.focus();
    return true;
  }
  return false;
}

/**
 * Focus the nearest alternative when the currently focused element
 * is about to be removed from the DOM (e.g., filtered out of a list).
 *
 * Tries the next element first, falls back to the previous one.
 * This prevents focus from being lost to the document body, which
 * is disorienting for screen reader users.
 *
 * @param target - The element that is about to be removed.
 * @param siblings - The ordered list of focusable siblings to choose from.
 * @returns true if a neighbor was focused, false if none available.
 *
 * @example
 * ```ts
 * // Before removing a filtered row from the table:
 * const rows = Array.from(table.querySelectorAll("[role=row]"));
 * focusNearest(removedRow, rows);
 * ```
 */
export function focusNearest(target: HTMLElement, siblings: HTMLElement[]): boolean {
  const index = siblings.indexOf(target);
  if (index === -1) return false;

  // Try next sibling first, then previous
  const nextIndex = index + 1;
  const prevIndex = index - 1;

  if (nextIndex < siblings.length && siblings[nextIndex] !== target) {
    siblings[nextIndex]!.focus();
    return true;
  }

  if (prevIndex >= 0 && siblings[prevIndex] !== target) {
    siblings[prevIndex]!.focus();
    return true;
  }

  return false;
}
