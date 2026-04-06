import { describe, it, expect, afterEach } from "vitest";
import { LogServer } from "../src/ws-server.js";
import WebSocket from "ws";
import type { LogEntry } from "../src/types.js";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: "test-1",
    timestamp: "2026-03-30T13:51:00.331Z",
    level: 1,
    tag: "test",
    message: "hello",
    ...overrides,
  };
}

describe("LogServer", () => {
  let server: LogServer;

  afterEach(async () => {
    await server?.stop();
  });

  it("starts and stops without error", async () => {
    server = new LogServer({ port: 0 });
    const port = await server.start();

    expect(port).toBeGreaterThan(0);
    await server.stop();
  });

  it("emits parsed log entries from WebSocket clients", async () => {
    server = new LogServer({ port: 0 });
    const port = await server.start();

    const received: LogEntry[] = [];
    server.on("entry", (entry) => received.push(entry));

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    const entry = makeEntry({ message: "from client" });
    ws.send(JSON.stringify(entry));

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(received).toHaveLength(1);
    expect(received[0]!.message).toBe("from client");

    ws.close();
  });

  it("handles multiple clients", async () => {
    server = new LogServer({ port: 0 });
    const port = await server.start();

    const received: LogEntry[] = [];
    server.on("entry", (entry) => received.push(entry));

    const ws1 = new WebSocket(`ws://localhost:${port}`);
    const ws2 = new WebSocket(`ws://localhost:${port}`);

    await Promise.all([
      new Promise<void>((resolve) => ws1.on("open", resolve)),
      new Promise<void>((resolve) => ws2.on("open", resolve)),
    ]);

    ws1.send(JSON.stringify(makeEntry({ message: "from client 1" })));
    ws2.send(JSON.stringify(makeEntry({ message: "from client 2" })));

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(received).toHaveLength(2);

    ws1.close();
    ws2.close();
  });

  it("ignores invalid JSON", async () => {
    server = new LogServer({ port: 0 });
    const port = await server.start();

    const received: LogEntry[] = [];
    server.on("entry", (entry) => received.push(entry));

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.send("not json at all");

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(received).toHaveLength(0);

    ws.close();
  });

  it("reports connected client count", async () => {
    server = new LogServer({ port: 0 });
    const port = await server.start();

    expect(server.clientCount).toBe(0);

    const ws = new WebSocket(`ws://localhost:${port}`);
    await new Promise<void>((resolve) => ws.on("open", resolve));

    expect(server.clientCount).toBe(1);

    ws.close();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(server.clientCount).toBe(0);
  });
});
