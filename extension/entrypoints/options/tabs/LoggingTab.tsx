/**
 * @module options/tabs/LoggingTab
 *
 * Logging settings tab — configure log level, WebSocket server URL
 * for streaming logs to the accessible log viewer, and export logs.
 *
 * The WebSocket transport is only connected when the user explicitly
 * provides a URL and the log server is running.
 */

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { sendLog } from "@/core/messaging/send";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { announce } from "@/shared/a11y/announcer";

/** Log level options matching LogLevel enum values. */
const LOG_LEVELS = [
  { value: "0", label: "DEBUG — All messages" },
  { value: "1", label: "INFO — Informational and above" },
  { value: "2", label: "WARN — Warnings and errors only" },
  { value: "3", label: "ERROR — Errors only" },
  { value: "4", label: "FATAL — Fatal errors only" },
];

export function LoggingTab() {
  const [logLevel, setLogLevel] = useState("1");
  const [logServerUrl, setLogServerUrl] = useState("ws://localhost:8089");
  const [logStreamEnabled, setLogStreamEnabled] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Load settings on mount
  useEffect(() => {
    async function load() {
      try {
        const stored = await browser.storage.local.get([
          "general.logLevel",
          "general.logServerUrl",
          "general.logStreamEnabled",
        ]);
        if (stored["general.logLevel"] !== undefined)
          setLogLevel(String(stored["general.logLevel"]));
        if (stored["general.logServerUrl"] !== undefined)
          setLogServerUrl(stored["general.logServerUrl"] as string);
        if (stored["general.logStreamEnabled"] !== undefined)
          setLogStreamEnabled(stored["general.logStreamEnabled"] as boolean);
      } catch {
        // Use defaults
      }
    }
    load();
  }, []);

  /** Toggle log streaming to the log server. */
  const handleLogStreamToggle = async (checked: boolean) => {
    setLogStreamEnabled(checked);
    await browser.storage.local.set({ "general.logStreamEnabled": checked });

    if (checked) {
      // Tell the background script to connect now
      await browser.runtime.sendMessage({ type: "CONNECT_LOG_SERVER" });
      announce("Log streaming enabled. Connecting to log server...", "assertive");
      sendLog("info", "Log streaming enabled by user");
    } else {
      // Disconnecting requires extension reload (transport can't be removed at runtime)
      announce("Log streaming disabled. Reload the extension for full effect.", "assertive");
      sendLog("info", "Log streaming disabled by user");
    }
  };

  const handleLogLevelChange = (value: string) => {
    setLogLevel(value);
    browser.storage.local.set({ "general.logLevel": Number(value) });
    const level = LOG_LEVELS.find((l) => l.value === value);
    announce(`Log level set to ${level?.label ?? value}`, "polite");
  };

  const handleUrlChange = (value: string) => {
    setLogServerUrl(value);
    browser.storage.local.set({ "general.logServerUrl": value });
  };

  const handleExport = async (format: "json" | "csv" | "html") => {
    announce(`Exporting logs as ${format.toUpperCase()}...`, "polite");
    try {
      const response = (await browser.runtime.sendMessage({
        type: "EXPORT_LOGS",
        format,
      })) as { success: boolean; data?: string; error?: string };

      if (!response.success || !response.data) {
        announce(`Export failed: ${response.error ?? "unknown error"}`, "assertive");
        return;
      }

      const mimeTypes = { json: "application/json", csv: "text/csv", html: "text/html" };
      const blob = new Blob([response.data], { type: mimeTypes[format] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `butterswitch-logs.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      announce(`Exported logs as ${format.toUpperCase()}`, "polite");
      sendLog("info", `Logs exported as ${format}`, { source: "options" });
    } catch {
      announce("Export failed. The extension may need to be reloaded.", "assertive");
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-xl font-semibold">Logging</h2>

      {/* Log Streaming */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Log Server</legend>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="log-stream-toggle">Stream logs to server</Label>
            <p className="text-sm text-muted-foreground">
              When enabled, extension logs stream to the log server for accessible viewing. This
              setting persists across restarts.
            </p>
          </div>
          <Switch
            id="log-stream-toggle"
            checked={logStreamEnabled}
            onCheckedChange={handleLogStreamToggle}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="log-server-url">Log Server URL</Label>
          <Input
            id="log-server-url"
            type="text"
            value={logServerUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="ws://localhost:8089"
            aria-describedby="log-server-hint"
            disabled={!logStreamEnabled}
          />
          <p id="log-server-hint" className="text-sm text-muted-foreground">
            WebSocket URL (ws:// or wss://). Start the log server with: pnpm log-server
          </p>
        </div>
      </fieldset>

      {/* Log Level */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Log Configuration</legend>

        <div className="space-y-2">
          <Label htmlFor="log-level">Minimum Log Level</Label>
          <Select value={logLevel} onValueChange={handleLogLevelChange}>
            <SelectTrigger id="log-level" className="w-full">
              <SelectValue placeholder="Select log level" />
            </SelectTrigger>
            <SelectContent>
              {LOG_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </fieldset>

      {/* Export */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Stored Logs</legend>
        <p className="text-sm text-muted-foreground">
          Logs are stored locally in the browser. Export them for debugging or clear to free space.
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => handleExport("json")}>
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => handleExport("csv")}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("html")}>
            Export HTML
          </Button>
          {!confirmClear ? (
            <Button
              variant="outline"
              onClick={() => {
                setConfirmClear(true);
                announce("Are you sure? Press Clear Logs again to confirm.", "assertive");
              }}
            >
              Clear Logs
            </Button>
          ) : (
            <Button
              variant="outline"
              className="border-destructive text-destructive"
              onClick={async () => {
                try {
                  const response = (await browser.runtime.sendMessage({
                    type: "CLEAR_LOGS",
                  })) as { success: boolean };
                  if (response.success) {
                    announce("All stored logs cleared", "polite");
                    sendLog("warn", "Logs cleared from IndexedDB", { source: "options" });
                  } else {
                    announce("Failed to clear logs", "assertive");
                  }
                } catch {
                  announce(
                    "Failed to clear logs. The extension may need to be reloaded.",
                    "assertive",
                  );
                }
                setConfirmClear(false);
              }}
            >
              Confirm Clear Logs
            </Button>
          )}
        </div>
      </fieldset>

      {/* Reset */}
      <Button
        variant="outline"
        onClick={() => {
          setLogLevel("1");
          setLogServerUrl("ws://localhost:8089");
          setLogStreamEnabled(false);
          browser.storage.local.set({
            "general.logLevel": 1,
            "general.logServerUrl": "ws://localhost:8089",
            "general.logStreamEnabled": false,
          });
          announce("Logging settings reset to defaults", "polite");
          sendLog("warn", "Logging settings reset to defaults", { source: "options" });
        }}
      >
        Reset Logging Settings
      </Button>
    </div>
  );
}
