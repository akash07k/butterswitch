import type { LogEntry } from "./types.js";

const LEVEL_LABELS: Record<number, string> = {
  0: "DEBUG",
  1: "INFO",
  2: "WARN",
  3: "ERROR",
  4: "FATAL",
};

function formatOrdinalDate(date: Date): string {
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleString("en-US", { month: "long" });
  return `${day}${suffix} ${month}, ${date.getFullYear()}`;
}

function formatTime12h(date: Date): string {
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const ampm = date.getHours() >= 12 ? "PM" : "AM";
  return `${hours}:${minutes}:${seconds}.${ms} ${ampm}`;
}

/**
 * Format a log entry for terminal output.
 * Screen-reader-friendly: no ANSI color codes, clean flat structure.
 * Format: LEVEL: tag | message [error] at DATE at TIME
 *
 * @param entry - The log entry to format.
 * @returns A single-line string suitable for terminal or plain-text file output.
 */
export function formatForTerminal(entry: LogEntry): string {
  const level = LEVEL_LABELS[entry.level] ?? `LEVEL${entry.level}`;
  const tag = entry.tag ? ` ${entry.tag} |` : "";
  const date = new Date(entry.timestamp);
  let line = `${level}:${tag} ${entry.message}`;

  if (entry.data) {
    line += ` ${JSON.stringify(entry.data)}`;
  }

  if (entry.error) {
    line += ` ${entry.error.name}: ${entry.error.message}`;
  }

  line += ` on ${formatOrdinalDate(date)} at ${formatTime12h(date)}`;

  return line;
}
