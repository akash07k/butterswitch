import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger } from "../src/core/logger.js";
import { LogLevel } from "../src/core/types.js";
import type { Transport, LogEntry } from "../src/core/types.js";

function createMockTransport(): Transport & { entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    name: "mock",
    entries,
    log: vi.fn((entry: LogEntry) => {
      entries.push(entry);
    }),
    flush: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  };
}

describe("createLogger", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("creates a logger that logs to transports", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    logger.info("hello");

    expect(transport.entries).toHaveLength(1);
    expect(transport.entries[0]!.message).toBe("hello");
    expect(transport.entries[0]!.level).toBe(LogLevel.INFO);
  });

  it("filters entries below the configured level", () => {
    const logger = createLogger({ level: LogLevel.WARN, transports: [transport] });
    logger.debug("should be skipped");
    logger.info("should be skipped");
    logger.warn("should pass");

    expect(transport.entries).toHaveLength(1);
    expect(transport.entries[0]!.message).toBe("should pass");
  });

  it("generates unique IDs for each entry", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    logger.info("one");
    logger.info("two");

    expect(transport.entries[0]!.id).toBeDefined();
    expect(transport.entries[0]!.id).not.toBe(transport.entries[1]!.id);
  });

  it("includes a timestamp in ISO 8601 format", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    logger.info("test");

    const ts = transport.entries[0]!.timestamp;
    expect(() => new Date(ts)).not.toThrow();
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it("attaches data to the log entry", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    logger.info("with data", { key: "value" });

    expect(transport.entries[0]!.data).toEqual({ key: "value" });
  });

  it("attaches error info when an Error is passed", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    const err = new Error("boom");
    logger.error("failed", err);

    expect(transport.entries[0]!.error).toMatchObject({
      name: "Error",
      message: "boom",
    });
    expect(transport.entries[0]!.error!.stack).toBeDefined();
  });

  it("logs fatal entries at FATAL level", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    logger.fatal("system down");

    expect(transport.entries[0]!.level).toBe(LogLevel.FATAL);
    expect(transport.entries[0]!.message).toBe("system down");
  });

  it("fatal attaches error info when an Error is passed", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    const err = new Error("critical");
    logger.fatal("crash", err);

    expect(transport.entries[0]!.error).toMatchObject({
      name: "Error",
      message: "critical",
    });
  });

  it("uses root tag when provided", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport], tag: "app" });
    logger.info("test");

    expect(transport.entries[0]!.tag).toBe("app");
  });

  it("uses empty tag when none provided", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    logger.info("test");

    expect(transport.entries[0]!.tag).toBe("");
  });
});

describe("child logger", () => {
  let transport: ReturnType<typeof createMockTransport>;

  beforeEach(() => {
    transport = createMockTransport();
  });

  it("appends tag segment with dot separator", () => {
    const logger = createLogger({
      level: LogLevel.DEBUG,
      transports: [transport],
      tag: "parent",
    });
    const child = logger.child({ tag: "child" });
    child.info("test");

    expect(transport.entries[0]!.tag).toBe("parent.child");
  });

  it("creates nested child loggers", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport], tag: "a" });
    const child = logger.child({ tag: "b" }).child({ tag: "c" });
    child.info("test");

    expect(transport.entries[0]!.tag).toBe("a.b.c");
  });

  it("child without parent tag uses child tag alone", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    const child = logger.child({ tag: "module" });
    child.info("test");

    expect(transport.entries[0]!.tag).toBe("module");
  });

  it("shares transports with parent", () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    const child = logger.child({ tag: "child" });

    logger.info("from parent");
    child.info("from child");

    expect(transport.entries).toHaveLength(2);
  });

  it("child stops writing once parent is disposed", async () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    const child = logger.child({ tag: "ui" });

    child.info("before parent dispose");
    expect(transport.log).toHaveBeenCalledTimes(1);

    await logger.dispose();

    child.info("after parent dispose");
    child.warn("still after");
    child.error("with error", new Error("x"));

    // Parent's dispose closed the shared transport. The child must
    // see that and skip dispatch instead of writing into closed handles.
    expect(transport.log).toHaveBeenCalledTimes(1);
  });

  it("child dispose does not close parent transports", async () => {
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    const child = logger.child({ tag: "ui" });

    await child.dispose();

    // Parent still owns the transport — disposing the child must not
    // call dispose() on it. The parent should keep writing normally.
    expect(transport.dispose).not.toHaveBeenCalled();

    logger.info("after child dispose");
    expect(transport.entries).toHaveLength(1);
    expect(transport.entries[0]!.message).toBe("after child dispose");
  });

  it("grandchild stops writing once any ancestor is disposed", async () => {
    const root = createLogger({ level: LogLevel.DEBUG, transports: [transport] });
    const child = root.child({ tag: "a" });
    const grandchild = child.child({ tag: "b" });

    await root.dispose();

    grandchild.info("walks the chain");
    expect(transport.log).toHaveBeenCalledTimes(0);
  });
});

describe("flush and dispose", () => {
  it("calls flush on all transports", async () => {
    const transport = createMockTransport();
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });

    await logger.flush();
    expect(transport.flush).toHaveBeenCalled();
  });

  it("calls dispose on all transports", async () => {
    const transport = createMockTransport();
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });

    await logger.dispose();
    expect(transport.dispose).toHaveBeenCalled();
  });

  it("log calls after dispose are no-ops — disposed transports are not invoked", async () => {
    const transport = createMockTransport();
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });

    logger.info("before dispose");
    expect(transport.entries).toHaveLength(1);

    await logger.dispose();

    logger.info("after dispose");
    logger.warn("after dispose");
    logger.error("after dispose", new Error("err"));

    // Still only the one pre-dispose entry — none of the post-dispose
    // calls reached the transport.
    expect(transport.entries).toHaveLength(1);
    expect(transport.log).toHaveBeenCalledTimes(1);
  });

  it("addTransport after dispose is silently dropped", async () => {
    const transport = createMockTransport();
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });

    await logger.dispose();

    const newTransport = createMockTransport();
    logger.addTransport(newTransport);

    logger.info("post-dispose log");
    expect(newTransport.entries).toHaveLength(0);
    expect(newTransport.log).not.toHaveBeenCalled();
  });

  it("dispose is idempotent — calling it twice does not double-dispose transports", async () => {
    const transport = createMockTransport();
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });

    await logger.dispose();
    await logger.dispose();

    expect(transport.dispose).toHaveBeenCalledTimes(1);
  });

  it("flush after dispose is a no-op", async () => {
    const transport = createMockTransport();
    const logger = createLogger({ level: LogLevel.DEBUG, transports: [transport] });

    await logger.dispose();
    await logger.flush();

    // dispose was called once during dispose(); flush was never called.
    expect(transport.flush).not.toHaveBeenCalled();
  });
});
