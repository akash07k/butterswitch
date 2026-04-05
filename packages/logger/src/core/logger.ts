import type { Logger, LoggerConfig, LogEntry, Transport } from "./types.js";
import { LogLevel } from "./types.js";

let idCounter = 0;

function generateId(): string {
  return `${Date.now()}-${++idCounter}`;
}

class LoggerImpl implements Logger {
  private readonly level: LogLevel;
  private readonly transports: Transport[];
  private readonly tag: string;

  constructor(config: LoggerConfig) {
    this.level = config.level;
    this.transports = config.transports;
    this.tag = config.tag ?? "";
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, dataOrError?: Record<string, unknown> | Error): void {
    this.logWithError(LogLevel.ERROR, message, dataOrError);
  }

  fatal(message: string, dataOrError?: Record<string, unknown> | Error): void {
    this.logWithError(LogLevel.FATAL, message, dataOrError);
  }

  child(options: { tag: string }): Logger {
    const childTag = this.tag ? `${this.tag}.${options.tag}` : options.tag;
    return new LoggerImpl({
      level: this.level,
      transports: this.transports,
      tag: childTag,
    });
  }

  async flush(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.flush?.()));
  }

  async dispose(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.dispose?.()));
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (level < this.level) return;

    const entry = this.createEntry(level, message);
    if (data) entry.data = data;
    this.dispatch(entry);
  }

  private logWithError(
    level: LogLevel,
    message: string,
    dataOrError?: Record<string, unknown> | Error,
  ): void {
    if (level < this.level) return;

    const entry = this.createEntry(level, message);
    if (dataOrError instanceof Error) {
      entry.error = {
        name: dataOrError.name,
        message: dataOrError.message,
        stack: dataOrError.stack,
      };
    } else if (dataOrError) {
      entry.data = dataOrError;
    }
    this.dispatch(entry);
  }

  private createEntry(level: LogLevel, message: string): LogEntry {
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      level,
      tag: this.tag,
      message,
    };
  }

  private dispatch(entry: LogEntry): void {
    for (const transport of this.transports) {
      try {
        transport.log(entry);
      } catch {
        // Transport errors must not crash the application
      }
    }
  }
}

/**
 * Create a logger instance with the given configuration.
 *
 * @example
 * ```ts
 * const logger = createLogger({
 *   level: LogLevel.DEBUG,
 *   transports: [new ConsoleTransport()],
 *   tag: "my-app",
 * });
 * logger.info("Hello world");
 * ```
 */
export function createLogger(config: LoggerConfig): Logger {
  return new LoggerImpl(config);
}
