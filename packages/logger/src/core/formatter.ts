import type { DateFormatter } from "./types.js";

/**
 * Default date formatter using ISO 8601 format.
 * Date: YYYY-MM-DD
 * Time: HH:MM:SS.mmm
 */
export class IsoDateFormatter implements DateFormatter {
  formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  formatTime(date: Date): string {
    return date.toISOString().slice(11, 23);
  }
}
