import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketTransport } from "../src/transports/websocket.js";
import { LogLevel } from "../src/core/types.js";
import type { LogEntry } from "../src/core/types.js";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: "test-1",
    timestamp: "2026-03-30T13:51:00.331Z",
    level: LogLevel.INFO,
    tag: "test",
    message: "hello",
    ...overrides,
  };
}

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  simulateOpen(): void {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateClose(): void {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }
}

describe("WebSocketTransport", () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = originalWebSocket;
  });

  it("has name 'websocket'", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8089" });
    expect(transport.name).toBe("websocket");
    transport.dispose();
  });

  it("connects to the configured URL", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8089" });
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]!.url).toBe("ws://localhost:8089");
    transport.dispose();
  });

  it("sends entry as JSON when connected", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8089" });
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    const entry = makeEntry({ message: "test" });
    transport.log(entry);

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(entry));
    transport.dispose();
  });

  it("buffers entries when disconnected", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8089" });
    const ws = MockWebSocket.instances[0]!;

    transport.log(makeEntry({ message: "buffered-1" }));
    transport.log(makeEntry({ message: "buffered-2" }));

    expect(ws.send).not.toHaveBeenCalled();
    transport.dispose();
  });

  it("flushes buffer when connection opens", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8089" });
    const ws = MockWebSocket.instances[0]!;

    transport.log(makeEntry({ message: "buffered" }));
    expect(ws.send).not.toHaveBeenCalled();

    ws.simulateOpen();
    expect(ws.send).toHaveBeenCalledOnce();
    transport.dispose();
  });

  it("drops oldest entries when buffer is full", () => {
    const transport = new WebSocketTransport({
      url: "ws://localhost:8089",
      bufferSize: 2,
    });
    const ws = MockWebSocket.instances[0]!;

    transport.log(makeEntry({ message: "oldest" }));
    transport.log(makeEntry({ message: "middle" }));
    transport.log(makeEntry({ message: "newest" }));

    ws.simulateOpen();
    expect(ws.send).toHaveBeenCalledTimes(2);
    const sent = ws.send.mock.calls.map((c: [string]) => JSON.parse(c[0]).message);
    expect(sent).not.toContain("oldest");
    transport.dispose();
  });

  it("reconnects after connection closes", () => {
    const transport = new WebSocketTransport({
      url: "ws://localhost:8089",
      reconnectDelay: 1000,
    });
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    ws.simulateClose();

    expect(MockWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
    transport.dispose();
  });

  it("closes the WebSocket on dispose", () => {
    const transport = new WebSocketTransport({ url: "ws://localhost:8089" });
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    transport.dispose();
    expect(ws.close).toHaveBeenCalled();
  });
});
