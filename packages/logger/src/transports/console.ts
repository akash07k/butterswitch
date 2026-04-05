import type { Transport, LogEntry } from "../core/types.js";
import { LogLevel } from "../core/types.js";

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.FATAL]: "FATAL",
};

const CONSOLE_METHODS: Record<LogLevel, "debug" | "log" | "warn" | "error"> = {
  [LogLevel.DEBUG]: "debug",
  [LogLevel.INFO]: "log",
  [LogLevel.WARN]: "warn",
  [LogLevel.ERROR]: "error",
  [LogLevel.FATAL]: "error",
};

/**
 * Transport that writes log entries to the browser/Node.js console.
 * Uses the appropriate console method for each log level.
 */
export class ConsoleTransport implements Transport {
  readonly name = "console";

  log(entry: LogEntry): void {
    const method = CONSOLE_METHODS[entry.level];
    const label = LEVEL_LABELS[entry.level];
    const tag = entry.tag ? ` [${entry.tag}]` : "";
    const formatted = `[${entry.timestamp}] [${label}]${tag} ${entry.message}`;

    if (entry.data) {
      console[method](formatted, entry.data);
    } else {
      console[method](formatted);
    }
  }
}
