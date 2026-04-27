import type { Logger, LoggerConfig, LogEntry, Transport } from "./types.js";
import { LogLevel } from "./types.js";

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Internal constructor options. The public {@link LoggerConfig} does
 * not expose `parent` — only `child()` sets it, so a user-built logger
 * always starts as a root.
 */
interface LoggerImplOptions extends LoggerConfig {
  parent?: LoggerImpl;
}

/**
 * Concrete implementation of {@link Logger}.
 * Instantiated exclusively through {@link createLogger}.
 */
class LoggerImpl implements Logger {
  private readonly level: LogLevel;
  private readonly transports: Transport[];
  private readonly tag: string;
  /**
   * Reference to the parent logger when this instance was created via
   * {@link child}. `child()` shallow-copies the parent's transports,
   * so once the parent is disposed those transports are closed but
   * the child holds no `disposed` flag of its own. Walking the parent
   * chain on every dispatch lets a child detect a post-dispose parent
   * and stop writing to already-closed transports.
   */
  private readonly parent: LoggerImpl | null;
  /**
   * Whether `dispose()` has been called. After disposal the logger
   * silently no-ops every method — calls to log() must not reach
   * already-disposed transports, and addTransport() to a dead logger
   * is a programming error we choose to swallow rather than crash on.
   */
  private disposed = false;

  constructor(config: LoggerImplOptions) {
    this.level = config.level;
    this.transports = config.transports;
    this.tag = config.tag ?? "";
    this.parent = config.parent ?? null;
  }

  /**
   * True if this logger or any ancestor has been disposed. Children
   * share transport instances with their parent, so a disposed parent
   * means the child's transports are closed too.
   */
  private isDisposed(): boolean {
    if (this.disposed) return true;
    for (let p: LoggerImpl | null = this.parent; p !== null; p = p.parent) {
      if (p.disposed) return true;
    }
    return false;
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
      parent: this,
    });
  }

  addTransport(transport: Transport): void {
    if (this.isDisposed()) return;
    this.transports.push(transport);
  }

  async flush(): Promise<void> {
    if (this.isDisposed()) return;
    await Promise.all(this.transports.map((t) => t.flush?.()));
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    await Promise.all(this.transports.map((t) => t.dispose?.()));
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (this.isDisposed()) return;
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
    if (this.isDisposed()) return;
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
