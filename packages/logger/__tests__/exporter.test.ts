import { describe, it, expect } from "vitest";
import { LogExporter } from "../src/export/exporter.js";
import { LogLevel } from "../src/core/types.js";
import type { LogEntry } from "../src/core/types.js";

const SAMPLE_ENTRIES: LogEntry[] = [
  {
    id: "1",
    timestamp: "2026-03-30T13:51:00.331Z",
    level: LogLevel.INFO,
    tag: "sound-engine",
    message: "Theme loaded",
    data: { theme: "subtle" },
  },
  {
    id: "2",
    timestamp: "2026-03-30T13:51:01.500Z",
    level: LogLevel.ERROR,
    tag: "audio",
    message: "Playback failed",
    error: { name: "Error", message: "No audio context", stack: "stack trace..." },
  },
];

describe("LogExporter", () => {
  describe("toJSON", () => {
    it("exports entries as a formatted JSON string", () => {
      const json = LogExporter.toJSON(SAMPLE_ENTRIES);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].message).toBe("Theme loaded");
      expect(parsed[1].message).toBe("Playback failed");
    });

    it("returns empty array JSON for no entries", () => {
      const json = LogExporter.toJSON([]);
      expect(JSON.parse(json)).toEqual([]);
    });
  });

  describe("toCSV", () => {
    it("includes header row", () => {
      const csv = LogExporter.toCSV(SAMPLE_ENTRIES);
      const lines = csv.split("\n");

      expect(lines[0]).toBe("id,timestamp,level,tag,message");
    });

    it("includes data rows", () => {
      const csv = LogExporter.toCSV(SAMPLE_ENTRIES);
      const lines = csv.split("\n");

      expect(lines).toHaveLength(3); // header + 2 entries
      expect(lines[1]).toContain("Theme loaded");
    });

    it("escapes commas and quotes in message", () => {
      const entries: LogEntry[] = [
        {
          id: "3",
          timestamp: "2026-03-30T14:00:00.000Z",
          level: LogLevel.INFO,
          tag: "test",
          message: 'has "quotes" and, commas',
        },
      ];
      const csv = LogExporter.toCSV(entries);
      const dataLine = csv.split("\n")[1]!;

      expect(dataLine).toContain('"has ""quotes"" and, commas"');
    });

    it("returns header only for no entries", () => {
      const csv = LogExporter.toCSV([]);
      expect(csv).toBe("id,timestamp,level,tag,message");
    });
  });

  describe("toHTML", () => {
    it("returns a complete HTML document", () => {
      const html = LogExporter.toHTML(SAMPLE_ENTRIES);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<table");
      expect(html).toContain("</table>");
    });

    it("includes all entries in table rows", () => {
      const html = LogExporter.toHTML(SAMPLE_ENTRIES);

      expect(html).toContain("Theme loaded");
      expect(html).toContain("Playback failed");
    });

    it("includes accessible table headers", () => {
      const html = LogExporter.toHTML(SAMPLE_ENTRIES);

      expect(html).toContain('<th scope="col"');
      expect(html).toContain("Timestamp");
      expect(html).toContain("Level");
      expect(html).toContain("Tag");
      expect(html).toContain("Message");
    });

    it("handles empty entries", () => {
      const html = LogExporter.toHTML([]);
      expect(html).toContain("<table");
      expect(html).toContain("</table>");
    });
  });
});
