import type { LogEntry } from "./types.js";

const LEVEL_LABELS: Record<number, string> = {
  0: "DEBUG",
  1: "INFO",
  2: "WARN",
  3: "ERROR",
  4: "FATAL",
};

/**
 * Formats a log entry for terminal output.
 * Screen-reader-friendly: no ANSI color codes, flat predictable structure.
 * Format: [TIMESTAMP] [LEVEL] [TAG] Message {data} Error: message
 */
export function formatForTerminal(entry: LogEntry): string {
  const level = LEVEL_LABELS[entry.level] ?? `LEVEL${entry.level}`;
  const tag = entry.tag ? ` [${entry.tag}]` : "";
  let line = `[${level}]${tag} ${entry.message}`;

  if (entry.data) {
    line += ` ${JSON.stringify(entry.data)}`;
  }

  if (entry.error) {
    line += ` ${entry.error.name}: ${entry.error.message}`;
  }

  line += ` [${entry.timestamp}]`;

  return line;
}
