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

  it("serialises seeding so concurrent log() calls do not lose increments", async () => {
    // Pre-populate the store via a first instance, then dispose it so
    // a fresh transport (the one under test) hits the seeding path.
    const sharedDbName = `concurrent-seed-${Date.now()}`;

    const seeder = new IndexedDBTransport({ dbName: sharedDbName, maxEntries: 1000 });
    for (let i = 0; i < 10; i++) {
      await seeder.log(makeEntry({ message: `seed-${i}` }));
    }
    expect(await seeder.count()).toBe(10);
    await seeder.dispose();

    // Fire two log() calls in parallel against a fresh instance so they
    // both reach the seeding gate before the probe resolves. The bug
    // fixed here would have the second caller increment writeCount
    // before the first caller's probe wrote the seeded value back,
    // dropping the store count by one.
    const reopened = new IndexedDBTransport({ dbName: sharedDbName, maxEntries: 1000 });
    await Promise.all([
      reopened.log(makeEntry({ message: "concurrent-a" })),
      reopened.log(makeEntry({ message: "concurrent-b" })),
    ]);

    expect(await reopened.count()).toBe(12);
    await reopened.dispose();
  });

  it("seeds writeCount from store population so rotation fires on cold start", async () => {
    // Simulate a service worker that wrote 99 entries, slept, and
    // woke up. The dbName is shared across both instances so
    // fake-indexeddb persists the data the way real IDB does.
    const sharedDbName = `cold-start-${Date.now()}`;

    const seeder = new IndexedDBTransport({ dbName: sharedDbName, maxEntries: 50 });
    for (let i = 0; i < 99; i++) {
      await seeder.log(makeEntry({ message: `seed-${i}` }));
    }
    // 99 writes have not yet hit the modulo-100 rotation check;
    // the store still holds the full 99.
    expect(await seeder.count()).toBe(99);
    await seeder.dispose();

    // Cold restart: a fresh instance against the same database.
    // Without the probe, writeCount restarts at 0 and rotation would
    // not fire until ~100 more writes — by which time the store
    // would hold 199 entries against a 50-entry cap.
    const reopened = new IndexedDBTransport({ dbName: sharedDbName, maxEntries: 50 });
    await reopened.log(makeEntry({ message: "first-after-cold-start" }));

    // Probe seeded writeCount=99; the new write took it to 100 →
    // rotation fired → store trimmed to maxEntries.
    const remaining = await reopened.count();
    expect(remaining).toBeLessThanOrEqual(50);
    await reopened.dispose();
  });
});
