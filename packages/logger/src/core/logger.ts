import type { Logger, LoggerConfig, LogEntry, Transport } from "./types.js";
import { LogLevel } from "./types.js";

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Concrete implementation of {@link Logger}.
 * Instantiated exclusively through {@link createLogger}.
 */
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
      transports: [...this.transports],
      tag: childTag,
    });
  }

  addTransport(transport: Transport): void {
    this.transports.push(transport);
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

  /**
   * Fan out a log entry to every registered transport.
   * Both synchronous throws and async rejections are silently
   * swallowed so a failing transport never crashes the application.
   */
  private dispatch(entry: LogEntry): void {
    for (const transport of this.transports) {
      try {
        const result = transport.log(entry);
        // Catch async transport rejections (e.g., IndexedDB, WebSocket)
        if (result && typeof result.catch === "function") {
          result.catch(() => {});
        }
      } catch {
        // Transport errors must not crash the application
      }
    }
  }
}

/**
 * Create a logger instance with the given configuration.
 *
 * @param config - Logger configuration including minimum level, transports,
 *   and optional root tag.
 * @returns A Logger instance ready to emit log entries.
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
