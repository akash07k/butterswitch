/**
 * Log severity levels in ascending order.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * A single log entry produced by the logger.
 */
export interface LogEntry {
  /** Auto-generated unique ID */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log severity level */
  level: LogLevel;
  /** Hierarchical tag (e.g., "sound-engine.audio-player") */
  tag: string;
  /** Human-readable message */
  message: string;
  /** Optional structured data payload */
  data?: Record<string, unknown>;
  /** Optional error information */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Interface all transports must implement.
 * A transport receives log entries and sends them somewhere.
 */
export interface Transport {
  /** Human-readable transport name (for diagnostics). */
  readonly name: string;

  /**
   * Process a single log entry. May be synchronous or return a Promise.
   * Implementations must not throw synchronously; async rejections are
   * silently swallowed by the dispatcher.
   * @param entry - The log entry to process.
   */
  log(entry: LogEntry): void | Promise<void>;

  /**
   * Flush any buffered log entries to the underlying storage or network.
   * @returns A promise that resolves when the flush is complete.
   */
  flush?(): Promise<void>;

  /**
   * Release all resources held by this transport.
   * @returns A promise that resolves when disposal is complete.
   */
  dispose?(): Promise<void>;
}

/**
 * Configuration for creating a logger instance.
 */
export interface LoggerConfig {
  /** Minimum log level — entries below this are discarded */
  level: LogLevel;
  /** Transports to send log entries to */
  transports: Transport[];
  /** Root tag for this logger (optional) */
  tag?: string;
}

/**
 * Public logger interface returned by createLogger.
 */
export interface Logger {
  /**
   * Emit a debug-level log entry.
   * @param message - Human-readable message describing the event.
   * @param data - Optional structured key/value payload.
   */
  debug(message: string, data?: Record<string, unknown>): void;

  /**
   * Emit an info-level log entry.
   * @param message - Human-readable message describing the event.
   * @param data - Optional structured key/value payload.
   */
  info(message: string, data?: Record<string, unknown>): void;

  /**
   * Emit a warn-level log entry.
   * @param message - Human-readable message describing the event.
   * @param data - Optional structured key/value payload.
   */
  warn(message: string, data?: Record<string, unknown>): void;

  /**
   * Emit an error-level log entry.
   * Pass an Error to capture its name, message, and stack trace.
   * @param message - Human-readable message describing the event.
   * @param dataOrError - Optional structured data payload, or an Error instance.
   */
  error(message: string, dataOrError?: Record<string, unknown> | Error): void;

  /**
   * Emit a fatal-level log entry.
   * Pass an Error to capture its name, message, and stack trace.
   * @param message - Human-readable message describing the event.
   * @param dataOrError - Optional structured data payload, or an Error instance.
   */
  fatal(message: string, dataOrError?: Record<string, unknown> | Error): void;

  /**
   * Create a child logger that inherits transports and minimum level,
   * appending the given tag segment with a `.` separator.
   * @param options - Object containing the tag segment to append.
   * @returns A new Logger instance with the composed tag.
   */
  child(options: { tag: string }): Logger;

  /**
   * Attach an additional transport at runtime.
   * The transport immediately begins receiving new log entries.
   * @param transport - The transport instance to add.
   */
  addTransport(transport: Transport): void;

  /**
   * Flush all transports, waiting for any buffered entries to be written.
   * @returns A promise that resolves when all transports have flushed.
   */
  flush(): Promise<void>;

  /**
   * Dispose all transports and release their underlying resources.
   * @returns A promise that resolves when all transports have disposed.
   */
  dispose(): Promise<void>;
}

/**
 * Configuration for IndexedDBTransport.
 */
export interface IndexedDBTransportConfig {
  /** Database name */
  dbName: string;
  /** Maximum number of entries before rotation (default: 10000) */
  maxEntries?: number;
  /** Object store name (default: "logs") */
  storeName?: string;
}

/**
 * Configuration for WebSocketTransport.
 */
export interface WebSocketTransportConfig {
  /** WebSocket server URL (e.g., "ws://localhost:8089") */
  url: string;
  /** Max entries to buffer while disconnected (default: 1000) */
  bufferSize?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Max reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
}

/**
 * Query options for retrieving logs from IndexedDB.
 */
export interface LogQuery {
  /** Filter by minimum log level */
  level?: LogLevel;
  /** Filter by tag prefix */
  tag?: string;
  /** Filter entries after this date */
  since?: Date;
  /** Filter entries before this date */
  until?: Date;
  /** Maximum entries to return */
  limit?: number;
}

/**
 * Supported export formats for the log exporter.
 */
export type ExportFormat = "json" | "csv" | "html";
