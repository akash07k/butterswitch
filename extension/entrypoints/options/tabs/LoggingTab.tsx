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

  // Load settings on mount
  useEffect(() => {
    async function load() {
      try {
        const stored = await browser.storage.local.get([
          "general.logLevel",
          "general.logServerUrl",
        ]);
        if (stored["general.logLevel"] !== undefined)
          setLogLevel(String(stored["general.logLevel"]));
        if (stored["general.logServerUrl"] !== undefined)
          setLogServerUrl(stored["general.logServerUrl"]);
      } catch {
        // Use defaults
      }
    }
    load();
  }, []);

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
    // TODO: Wire to IndexedDB log export when available
    announce(`Log export not yet implemented`, "polite");
  };

  return (
    <div className="space-y-6 mt-4">
      <h2 className="text-xl font-semibold">Logging</h2>

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

        <div className="space-y-2">
          <Label htmlFor="log-server-url">Log Server URL</Label>
          <Input
            id="log-server-url"
            type="url"
            value={logServerUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="ws://localhost:8089"
          />
          <p className="text-sm text-muted-foreground">
            Start the log server with: pnpm log-server
          </p>
        </div>
      </fieldset>

      {/* Export */}
      <fieldset className="space-y-4 border rounded-lg p-4">
        <legend className="text-sm font-semibold px-2">Export Logs</legend>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("json")}>
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => handleExport("csv")}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => handleExport("html")}>
            Export HTML
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
