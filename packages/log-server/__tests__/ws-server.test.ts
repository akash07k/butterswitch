import { describe, it, expect, afterEach } from "vitest";
import { LogServer, isValidLogEntry } from "../src/ws-server.js";
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

describe("isValidLogEntry", () => {
  it("accepts a well-formed entry", () => {
    expect(isValidLogEntry(makeEntry())).toBe(true);
  });

  it("rejects an entry with an out-of-range level", () => {
    const entry = { ...makeEntry(), level: 99 };
    expect(isValidLogEntry(entry)).toBe(false);
  });

  it("rejects an entry with a negative level", () => {
    const entry = { ...makeEntry(), level: -1 };
    expect(isValidLogEntry(entry)).toBe(false);
  });

  it("rejects non-integer level values", () => {
    expect(isValidLogEntry({ ...makeEntry(), level: 1.5 })).toBe(false);
    expect(isValidLogEntry({ ...makeEntry(), level: Number.NaN })).toBe(false);
    expect(isValidLogEntry({ ...makeEntry(), level: Number.POSITIVE_INFINITY })).toBe(false);
  });
});

describe("LogServer.isAllowedOrigin", () => {
  it("allows missing origin (non-browser clients)", () => {
    expect(LogServer.isAllowedOrigin(undefined)).toBe(true);
    expect(LogServer.isAllowedOrigin("")).toBe(true);
  });

  it("allows same-origin loopback hosts", () => {
    expect(LogServer.isAllowedOrigin("http://localhost:8089")).toBe(true);
    expect(LogServer.isAllowedOrigin("http://127.0.0.1:8089")).toBe(true);
    expect(LogServer.isAllowedOrigin("http://[::1]:8089")).toBe(true);
  });

  it("allows browser extension origins", () => {
    expect(LogServer.isAllowedOrigin("chrome-extension://abcdef")).toBe(true);
    expect(LogServer.isAllowedOrigin("moz-extension://12345")).toBe(true);
  });

  it("rejects arbitrary external origins", () => {
    expect(LogServer.isAllowedOrigin("http://evil.com")).toBe(false);
    expect(LogServer.isAllowedOrigin("https://example.com")).toBe(false);
    expect(LogServer.isAllowedOrigin("http://192.168.1.5:8089")).toBe(false);
  });

  it("rejects malformed origins", () => {
    expect(LogServer.isAllowedOrigin("not a url")).toBe(false);
  });
});

describe("LogServer Origin enforcement", () => {
  let server: LogServer;

  afterEach(async () => {
    await server?.stop();
  });

  it("rejects WebSocket upgrades from disallowed origins", async () => {
    server = new LogServer({ port: 0 });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`, { origin: "http://evil.com" });
    const result = await new Promise<"open" | "error">((resolve) => {
      ws.once("open", () => resolve("open"));
      ws.once("error", () => resolve("error"));
    });

    expect(result).toBe("error");
  });

  it("accepts WebSocket upgrades from chrome-extension origin", async () => {
    server = new LogServer({ port: 0 });
    const port = await server.start();

    const ws = new WebSocket(`ws://localhost:${port}`, { origin: "chrome-extension://abc" });
    const result = await new Promise<"open" | "error">((resolve) => {
      ws.once("open", () => resolve("open"));
      ws.once("error", () => resolve("error"));
    });

    expect(result).toBe("open");
    ws.close();
  });
});
