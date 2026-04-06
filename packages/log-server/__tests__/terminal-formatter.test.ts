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
  it("formats a basic log entry", () => {
    const result = formatForTerminal(makeEntry());

    expect(result).toBe("[INFO] [sound-engine] Theme loaded [2026-03-30T13:51:00.331Z]");
  });

  it("formats DEBUG level", () => {
    const result = formatForTerminal(makeEntry({ level: 0 }));
    expect(result).toContain("[DEBUG]");
  });

  it("formats WARN level", () => {
    const result = formatForTerminal(makeEntry({ level: 2 }));
    expect(result).toContain("[WARN]");
  });

  it("formats ERROR level", () => {
    const result = formatForTerminal(makeEntry({ level: 3 }));
    expect(result).toContain("[ERROR]");
  });

  it("formats FATAL level", () => {
    const result = formatForTerminal(makeEntry({ level: 4 }));
    expect(result).toContain("[FATAL]");
  });

  it("handles empty tag", () => {
    const result = formatForTerminal(makeEntry({ tag: "" }));

    expect(result).toBe("[INFO] Theme loaded [2026-03-30T13:51:00.331Z]");
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

  it("has no ANSI codes by default", () => {
    const result = formatForTerminal(makeEntry());

    // ANSI escape codes start with \x1b[
    // eslint-disable-next-line no-control-regex
    expect(result).not.toMatch(/\x1b\[/);
  });
});
