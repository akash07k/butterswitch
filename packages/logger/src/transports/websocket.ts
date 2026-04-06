import type { Transport, LogEntry, WebSocketTransportConfig } from "../core/types.js";

const DEFAULT_BUFFER_SIZE = 1000;
const DEFAULT_RECONNECT_DELAY = 1000;
const DEFAULT_MAX_RECONNECT_DELAY = 30_000;

/**
 * Transport that streams log entries over WebSocket.
 * Auto-reconnects with exponential backoff.
 * Buffers entries while disconnected (bounded buffer).
 */
export class WebSocketTransport implements Transport {
  readonly name = "websocket";

  private readonly url: string;
  private readonly bufferSize: number;
  private readonly reconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private buffer: LogEntry[] = [];
  private ws: WebSocket | null = null;
  private currentDelay: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(config: WebSocketTransportConfig) {
    this.url = config.url;
    this.bufferSize = config.bufferSize ?? DEFAULT_BUFFER_SIZE;
    this.reconnectDelay = config.reconnectDelay ?? DEFAULT_RECONNECT_DELAY;
    this.maxReconnectDelay = config.maxReconnectDelay ?? DEFAULT_MAX_RECONNECT_DELAY;
    this.currentDelay = this.reconnectDelay;
    this.connect();
  }

  log(entry: LogEntry): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(entry));
    } else {
      this.buffer.push(entry);
      if (this.buffer.length > this.bufferSize) {
        this.buffer.shift();
      }
    }
  }

  async flush(): Promise<void> {
    this.flushBuffer();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.buffer = [];
  }

  private connect(): void {
    if (this.disposed) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.currentDelay = this.reconnectDelay;
      this.flushBuffer();
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }

  private flushBuffer(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    while (this.buffer.length > 0) {
      const entry = this.buffer.shift()!;
      this.ws.send(JSON.stringify(entry));
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.currentDelay);

    this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelay);
  }
}
