/**
 * @module web/lib/announce
 *
 * Centralized screen-reader announcement helpers for the log viewer.
 *
 * Why this exists: NVDA cancels the previous polite live-region message
 * every time a new one arrives. The viewer fires announcements from many
 * independent callers (sort, filter, expand, count tick, session change,
 * column toggle…) and a "live-region storm" of overlapping announcements
 * means the user only hears the LAST one in any 200ms burst.
 *
 * `enqueueAnnounce` collects polite messages within a short window and
 * delivers them as a single combined announcement. `announceAssertive`
 * bypasses the queue for urgent events that genuinely interrupt — reserve
 * for real errors and fatal connection loss.
 */

import { announce as ariaAnnounce } from "@react-aria/live-announcer";

/**
 * Window during which polite announcements are collected before being
 * delivered as a single combined message. 200 ms is short enough that
 * the user does not perceive a delay, long enough to absorb the typical
 * cluster of "X happened" messages that fire from a single user action
 * (e.g., a checkbox toggle producing both a sort and a count tick).
 */
const QUEUE_FLUSH_MS = 200;

const queue: string[] = [];
let scheduled: ReturnType<typeof setTimeout> | null = null;

/**
 * Queue a polite announcement. Multiple calls within {@link QUEUE_FLUSH_MS}
 * are coalesced into a single space-separated message, preventing each
 * announcement from cancelling the previous one.
 */
export function enqueueAnnounce(message: string): void {
  if (!message) return;
  queue.push(message);
  if (scheduled !== null) return;
  scheduled = setTimeout(() => {
    const combined = queue.splice(0).join(". ");
    scheduled = null;
    if (combined) {
      ariaAnnounce(combined, "polite");
    }
  }, QUEUE_FLUSH_MS);
}

/**
 * Make an assertive announcement immediately — interrupts whatever the
 * screen reader is currently saying. Reserve for real errors and events
 * the user must hear right now (failed session load, connection
 * permanently lost). Routine status changes should use
 * {@link enqueueAnnounce} instead.
 */
export function announceAssertive(message: string): void {
  if (!message) return;
  ariaAnnounce(message, "assertive");
}

/**
 * Test-only: drain any pending queued announcements synchronously.
 * Production code should not call this.
 */
export function _flushAnnounceQueueForTest(): void {
  if (scheduled !== null) {
    clearTimeout(scheduled);
    scheduled = null;
  }
  const combined = queue.splice(0).join(". ");
  if (combined) {
    ariaAnnounce(combined, "polite");
  }
}
