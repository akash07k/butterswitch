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
 * Pluggable date/time formatter.
 * Default implementation uses ISO 8601.
 * Consumers can provide custom formatters (e.g., ordinal dates).
 */
export interface DateFormatter {
  formatDate(date: Date): string;
  formatTime(date: Date): string;
}

/**
 * Interface all transports must implement.
 * A transport receives log entries and sends them somewhere.
 */
export interface Transport {
  /** Human-readable transport name (for diagnostics) */
  readonly name: string;
  /** Process a log entry */
  log(entry: LogEntry): void | Promise<void>;
  /** Flush any buffered entries */
  flush?(): Promise<void>;
  /** Release resources */
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
  /** Custom date/time formatter (ISO 8601 if omitted) */
  formatter?: DateFormatter;
  /** Root tag for this logger (optional) */
  tag?: string;
}

/**
 * Public logger interface returned by createLogger.
 */
export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, dataOrError?: Record<string, unknown> | Error): void;
  fatal(message: string, dataOrError?: Record<string, unknown> | Error): void;
  /** Create a child logger with an appended tag segment */
  child(options: { tag: string }): Logger;
  /** Add a transport dynamically after logger creation */
  addTransport(transport: Transport): void;
  /** Flush all transports */
  flush(): Promise<void>;
  /** Dispose all transports and release resources */
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
