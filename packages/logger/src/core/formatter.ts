import type { DateFormatter } from "./types.js";

/**
 * Default date formatter using ISO 8601 format.
 * Date: YYYY-MM-DD
 * Time: HH:MM:SS.mmm
 */
export class IsoDateFormatter implements DateFormatter {
  /**
   * @param date - The date to format.
   * @returns ISO 8601 date string, e.g., "2026-04-05".
   */
  formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * @param date - The date to format.
   * @returns ISO 8601 time string, e.g., "14:30:00.000".
   */
  formatTime(date: Date): string {
    return date.toISOString().slice(11, 23);
  }
}
