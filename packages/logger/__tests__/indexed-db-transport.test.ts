import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { IndexedDBTransport } from "../src/transports/indexed-db.js";
import { LogLevel } from "../src/core/types.js";
import type { LogEntry } from "../src/core/types.js";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    tag: "test",
    message: "hello",
    ...overrides,
  };
}

describe("IndexedDBTransport", () => {
  let transport: IndexedDBTransport;

  beforeEach(() => {
    transport = new IndexedDBTransport({ dbName: `test-${Date.now()}` });
  });

  afterEach(async () => {
    await transport.dispose();
  });

  it("has name 'indexeddb'", () => {
    expect(transport.name).toBe("indexeddb");
  });

  it("stores a log entry", async () => {
    await transport.log(makeEntry({ message: "stored" }));
    const entries = await transport.query({});

    expect(entries).toHaveLength(1);
    expect(entries[0]!.message).toBe("stored");
  });

  it("stores multiple entries", async () => {
    await transport.log(makeEntry({ message: "one" }));
    await transport.log(makeEntry({ message: "two" }));
    await transport.log(makeEntry({ message: "three" }));

    const entries = await transport.query({});
    expect(entries).toHaveLength(3);
  });

  it("queries by log level", async () => {
    await transport.log(makeEntry({ level: LogLevel.DEBUG, message: "debug" }));
    await transport.log(makeEntry({ level: LogLevel.INFO, message: "info" }));
    await transport.log(makeEntry({ level: LogLevel.ERROR, message: "error" }));

    const errors = await transport.query({ level: LogLevel.ERROR });
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe("error");
  });

  it("queries by tag prefix", async () => {
    await transport.log(makeEntry({ tag: "sound-engine", message: "a" }));
    await transport.log(makeEntry({ tag: "sound-engine.audio", message: "b" }));
    await transport.log(makeEntry({ tag: "module-system", message: "c" }));

    const soundLogs = await transport.query({ tag: "sound-engine" });
    expect(soundLogs).toHaveLength(2);
  });

  it("queries with limit", async () => {
    for (let i = 0; i < 10; i++) {
      await transport.log(makeEntry({ message: `msg-${i}` }));
    }

    const limited = await transport.query({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it("rotates entries when maxEntries is reached", async () => {
    const smallTransport = new IndexedDBTransport({
      dbName: `rotation-${Date.now()}`,
      maxEntries: 50,
    });

    // Write 200 entries — rotation runs every 100 writes.
    // After write 100: has 100, removes 50, left with 50.
    // Writes 101-200 add 100 more = 150. At write 200: removes 100, left with 50.
    for (let i = 0; i < 200; i++) {
      await smallTransport.log(makeEntry({ message: `msg-${i}` }));
    }

    const entries = await smallTransport.query({});
    expect(entries.length).toBeLessThanOrEqual(50);
    await smallTransport.dispose();
  });

  it("clears all entries", async () => {
    await transport.log(makeEntry({ message: "one" }));
    await transport.log(makeEntry({ message: "two" }));
    await transport.clear();

    const entries = await transport.query({});
    expect(entries).toHaveLength(0);
  });

  it("returns entry count", async () => {
    await transport.log(makeEntry());
    await transport.log(makeEntry());

    const count = await transport.count();
    expect(count).toBe(2);
  });
});
