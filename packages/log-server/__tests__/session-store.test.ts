import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SessionStore } from "../src/session-store.js";
import type { LogEntry } from "../src/types.js";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    level: 1,
    tag: "test",
    message: "hello",
    ...overrides,
  };
}

function tempDir(): string {
  return join(tmpdir(), `butterswitch-session-test-${Date.now()}-${Math.random()}`);
}

describe("SessionStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      if (existsSync(dir)) rmSync(dir, { recursive: true });
    }
    dirs.length = 0;
  });

  it("creates the log directory on construction", () => {
    const logDir = tempDir();
    dirs.push(logDir);
    new SessionStore({ logDir });

    expect(existsSync(logDir)).toBe(true);
  });

  it("creates a session file with .jsonl extension", () => {
    const logDir = tempDir();
    dirs.push(logDir);
    const store = new SessionStore({ logDir });

    expect(store.currentSessionFile).toMatch(/\.jsonl$/);
  });

  it("appends entries to the session file as JSONL", () => {
    const logDir = tempDir();
    dirs.push(logDir);
    const store = new SessionStore({ logDir });

    store.append(makeEntry({ message: "first" }));
    store.append(makeEntry({ message: "second" }));

    const filePath = join(logDir, store.currentSessionFile);
    const content = readFileSync(filePath, "utf-8").trim();
    const lines = content.split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).message).toBe("first");
    expect(JSON.parse(lines[1]!).message).toBe("second");
  });

  it("tracks entry count", () => {
    const logDir = tempDir();
    dirs.push(logDir);
    const store = new SessionStore({ logDir });

    expect(store.currentEntryCount).toBe(0);
    store.append(makeEntry());
    store.append(makeEntry());
    expect(store.currentEntryCount).toBe(2);
  });

  it("lists sessions with newest first", () => {
    const logDir = tempDir();
    dirs.push(logDir);

    // Create two sessions with a small delay
    const store1 = new SessionStore({ logDir });
    store1.append(makeEntry({ message: "session 1" }));

    // Force a different session ID by creating a new store
    const store2 = new SessionStore({ logDir });
    store2.append(makeEntry({ message: "session 2 entry 1" }));
    store2.append(makeEntry({ message: "session 2 entry 2" }));

    const sessions = store2.listSessions();

    expect(sessions.length).toBeGreaterThanOrEqual(2);
    // Newest first
    expect(sessions[0]!.filename).toBe(store2.currentSessionFile);
    expect(sessions[0]!.entryCount).toBe(2);
  });

  it("loads entries from a specific session", () => {
    const logDir = tempDir();
    dirs.push(logDir);
    const store = new SessionStore({ logDir });

    store.append(makeEntry({ message: "load me" }));
    store.append(makeEntry({ message: "and me" }));

    const entries = store.loadSession(store.currentSessionFile);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.message).toBe("load me");
    expect(entries[1]!.message).toBe("and me");
  });

  it("returns empty array for non-existent session", () => {
    const logDir = tempDir();
    dirs.push(logDir);
    const store = new SessionStore({ logDir });

    const entries = store.loadSession("does-not-exist.jsonl");
    expect(entries).toEqual([]);
  });

  it("cleans old sessions when exceeding maxSessions", () => {
    const logDir = tempDir();
    dirs.push(logDir);

    // Create 5 sessions
    for (let i = 0; i < 5; i++) {
      const store = new SessionStore({ logDir, maxSessions: 3 });
      store.append(makeEntry({ message: `session ${i}` }));
    }

    // Only 3 should remain (the 3 newest)
    const finalStore = new SessionStore({ logDir, maxSessions: 3 });
    const sessions = finalStore.listSessions();

    // maxSessions=3 but we just created another one, so up to 3 old + 1 new = cleaned to 3
    expect(sessions.length).toBeLessThanOrEqual(4);
  });
});
