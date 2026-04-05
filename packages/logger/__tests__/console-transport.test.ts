import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConsoleTransport } from "../src/transports/console.js";
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

describe("ConsoleTransport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("has name 'console'", () => {
    const transport = new ConsoleTransport();
    expect(transport.name).toBe("console");
  });

  it("logs DEBUG entries to console.debug", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    transport.log(makeEntry({ level: LogLevel.DEBUG }));

    expect(spy).toHaveBeenCalledOnce();
  });

  it("logs INFO entries to console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    transport.log(makeEntry({ level: LogLevel.INFO }));

    expect(spy).toHaveBeenCalledOnce();
  });

  it("logs WARN entries to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    transport.log(makeEntry({ level: LogLevel.WARN }));

    expect(spy).toHaveBeenCalledOnce();
  });

  it("logs ERROR entries to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    transport.log(makeEntry({ level: LogLevel.ERROR }));

    expect(spy).toHaveBeenCalledOnce();
  });

  it("logs FATAL entries to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    transport.log(makeEntry({ level: LogLevel.FATAL }));

    expect(spy).toHaveBeenCalledOnce();
  });

  it("includes tag and message in output", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    transport.log(makeEntry({ tag: "my-module", message: "test message" }));

    const output = spy.mock.calls[0]![0] as string;
    expect(output).toContain("my-module");
    expect(output).toContain("test message");
  });

  it("includes data when present", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const transport = new ConsoleTransport();
    transport.log(makeEntry({ data: { key: "value" } }));

    const args = spy.mock.calls[0]!;
    expect(args).toHaveLength(2);
    expect(args[1]).toEqual({ key: "value" });
  });
});
