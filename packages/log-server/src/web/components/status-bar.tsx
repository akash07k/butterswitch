import { Button, Checkbox } from "react-aria-components";
import { announce } from "@react-aria/live-announcer";
import type { LogEntry } from "../../types.js";

interface StatusBarProps {
  connected: boolean;
  autoScroll: boolean;
  onAutoScrollChange: (value: boolean) => void;
  entries: LogEntry[];
  onReconnect: () => void;
}

export function StatusBar({
  connected,
  autoScroll,
  onAutoScrollChange,
  entries,
  onReconnect,
}: StatusBarProps) {
  const handleAutoScrollChange = (isSelected: boolean) => {
    onAutoScrollChange(isSelected);
    announce(isSelected ? "Auto-scroll enabled" : "Auto-scroll paused", "polite");
  };

  const handleExport = (format: "json" | "csv" | "html") => {
    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === "json") {
      content = JSON.stringify(entries, null, 2);
      mimeType = "application/json";
      extension = "json";
    } else if (format === "csv") {
      const header = "id,timestamp,level,tag,message";
      const rows = entries.map((e) =>
        [e.id, e.timestamp, e.level, e.tag, `"${e.message.replace(/"/g, '""')}"`].join(","),
      );
      content = [header, ...rows].join("\n");
      mimeType = "text/csv";
      extension = "csv";
    } else {
      content = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Log Export</title></head><body><table><thead><tr><th>Timestamp</th><th>Level</th><th>Tag</th><th>Message</th></tr></thead><tbody>${entries.map((e) => `<tr><td>${e.timestamp}</td><td>${e.level}</td><td>${e.tag}</td><td>${e.message}</td></tr>`).join("")}</tbody></table></body></html>`;
      mimeType = "text/html";
      extension = "html";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `butterswitch-logs.${extension}`;
    a.click();
    URL.revokeObjectURL(url);

    announce(`Exported ${entries.length} entries as ${format.toUpperCase()}`, "polite");
  };

  return (
    <div className="status-bar">
      <span className={connected ? "status-connected" : "status-disconnected"}>
        {connected ? "Connected" : "Disconnected"}
      </span>

      {!connected && <Button onPress={onReconnect}>Reconnect</Button>}

      <Checkbox isSelected={autoScroll} onChange={handleAutoScrollChange}>
        Auto-scroll to new entries
      </Checkbox>

      <span>
        <Button onPress={() => handleExport("json")}>Export JSON</Button>
        <Button onPress={() => handleExport("csv")}>Export CSV</Button>
        <Button onPress={() => handleExport("html")}>Export HTML</Button>
      </span>
    </div>
  );
}
