import { describe, it, expect } from "vitest";
import { formatForTerminal } from "../src/terminal-formatter.js";
import type { LogEntry } from "../src/types.js";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: "test-1",
    timestamp: "2026-03-30T13:51:00.331Z",
    level: 1, // INFO
    tag: "sound-engine",
    message: "Theme loaded",
    ...overrides,
  };
}

describe("formatForTerminal", () => {
  it("formats a basic log entry with ordinal date", () => {
    const result = formatForTerminal(makeEntry());

    expect(result).toMatch(/^INFO: sound-engine \| Theme loaded on .+ at .+$/);
    expect(result).toContain("2026");
  });

  it("formats DEBUG level", () => {
    const result = formatForTerminal(makeEntry({ level: 0 }));
    expect(result).toMatch("DEBUG:");
  });

  it("formats WARN level", () => {
    const result = formatForTerminal(makeEntry({ level: 2 }));
    expect(result).toMatch("WARN:");
  });

  it("formats ERROR level", () => {
    const result = formatForTerminal(makeEntry({ level: 3 }));
    expect(result).toMatch("ERROR:");
  });

  it("formats FATAL level", () => {
    const result = formatForTerminal(makeEntry({ level: 4 }));
    expect(result).toMatch("FATAL:");
  });

  it("handles empty tag without pipe separator", () => {
    const result = formatForTerminal(makeEntry({ tag: "" }));

    expect(result).toMatch("INFO: Theme loaded");
    expect(result).not.toContain("|");
  });

  it("includes data as JSON when present", () => {
    const result = formatForTerminal(makeEntry({ data: { theme: "subtle" } }));

    expect(result).toContain('{"theme":"subtle"}');
  });

  it("includes error info when present", () => {
    const result = formatForTerminal(
      makeEntry({
        error: { name: "Error", message: "boom", stack: "stack..." },
      }),
    );

    expect(result).toContain("Error: boom");
  });

  it("has no ANSI codes", () => {
    const result = formatForTerminal(makeEntry());

    // eslint-disable-next-line no-control-regex
    expect(result).not.toMatch(/\x1b\[/);
  });

  it("uses 12-hour time with AM/PM", () => {
    const result = formatForTerminal(makeEntry({ timestamp: "2026-03-30T15:30:00.000Z" }));

    expect(result).toMatch(/\d+:\d+:\d+\.\d+ [AP]M$/);
  });

  it("uses ordinal date format", () => {
    const result = formatForTerminal(makeEntry({ timestamp: "2026-03-31T01:39:48.690Z" }));

    expect(result).toContain("31st");
    expect(result).toContain("March");
    expect(result).toContain("2026");
  });
});
