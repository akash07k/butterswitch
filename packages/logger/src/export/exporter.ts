import type { LogEntry } from "../core/types.js";
import { LogLevel } from "../core/types.js";

const LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARN",
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.FATAL]: "FATAL",
};

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Exports log entries to JSON, CSV, or HTML format.
 * All methods are static — no instantiation needed.
 */
export class LogExporter {
  static toJSON(entries: LogEntry[]): string {
    return JSON.stringify(entries, null, 2);
  }

  static toCSV(entries: LogEntry[]): string {
    const header = "id,timestamp,level,tag,message";
    if (entries.length === 0) return header;

    const rows = entries.map((e) =>
      [
        escapeCSV(e.id),
        escapeCSV(e.timestamp),
        escapeCSV(LEVEL_NAMES[e.level]),
        escapeCSV(e.tag),
        escapeCSV(e.message),
      ].join(","),
    );

    return [header, ...rows].join("\n");
  }

  static toHTML(entries: LogEntry[]): string {
    const rows = entries
      .map(
        (e) => `    <tr>
      <td>${escapeHTML(e.timestamp)}</td>
      <td>${escapeHTML(LEVEL_NAMES[e.level])}</td>
      <td>${escapeHTML(e.tag)}</td>
      <td>${escapeHTML(e.message)}</td>
    </tr>`,
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Log Export</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 0.5rem; text-align: left; }
    th { background: #222; color: #fff; }
    tr:nth-child(even) { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Log Export</h1>
  <table>
    <thead>
      <tr>
        <th scope="col">Timestamp</th>
        <th scope="col">Level</th>
        <th scope="col">Tag</th>
        <th scope="col">Message</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`;
  }
}
