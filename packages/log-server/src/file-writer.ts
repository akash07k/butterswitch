import { appendFileSync } from "node:fs";
import { formatForTerminal } from "./terminal-formatter.js";
import type { LogEntry } from "./types.js";

/**
 * Appends formatted log entries to a file.
 * Uses the same terminal formatter for consistent output.
 */
export class FileWriter {
  private readonly path: string;

  /** @param path - Path to the log file. Created if it does not exist. */
  constructor(path: string) {
    this.path = path;
  }

  /** Append a formatted log entry as a single line to the output file. @param entry - The log entry to write. */
  write(entry: LogEntry): void {
    appendFileSync(this.path, formatForTerminal(entry) + "\n");
  }

  /** No-op. Included for API consistency with future streaming implementations. */
  close(): void {
    // appendFileSync has no handle to close — this is a no-op
    // but keeps the API consistent for future streaming implementation
  }
}
