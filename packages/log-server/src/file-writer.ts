import { appendFileSync } from "node:fs";
import { formatForTerminal } from "./terminal-formatter.js";
import type { LogEntry } from "./types.js";

/**
 * Appends formatted log entries to a file.
 * Uses the same terminal formatter for consistent output.
 */
export class FileWriter {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  write(entry: LogEntry): void {
    appendFileSync(this.path, formatForTerminal(entry) + "\n");
  }

  close(): void {
    // appendFileSync has no handle to close — this is a no-op
    // but keeps the API consistent for future streaming implementation
  }
}
