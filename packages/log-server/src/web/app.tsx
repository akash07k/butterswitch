import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { announce } from "@react-aria/live-announcer";
import { VisuallyHidden } from "react-aria";
import type { LogEntry } from "../types.js";
import { StatusBar } from "./components/status-bar.js";
import { SearchBar } from "./components/search-bar.js";
import { LevelFilter } from "./components/level-filter.js";
import { LogTable } from "./components/log-table.js";

const ALL_LEVELS = [0, 1, 2, 3, 4];
const RECONNECT_DELAY = 2000;
const ENTRY_ANNOUNCE_INTERVAL = 3000;

function App() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [enabledLevels, setEnabledLevels] = useState<number[]>(ALL_LEVELS);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "date",
    "time",
    "level",
    "tag",
    "message",
  ]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const newEntryCountRef = useRef(0);

  // WebSocket connection with reconnect
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setConnected(true);
        announce("Connected to log server", "assertive");
      };

      ws.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data as string) as LogEntry;
          setEntries((prev) => [...prev, entry]);
          newEntryCountRef.current++;
        } catch {
          // Ignore invalid messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        if (!disposed) {
          announce("Disconnected from log server. Attempting to reconnect...", "assertive");
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
        }
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [reconnectTrigger]);

  // Batch announce new entries (polite, every 3 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      const count = newEntryCountRef.current;
      if (count > 0) {
        announce(`${count} new log ${count === 1 ? "entry" : "entries"} received`, "polite");
        newEntryCountRef.current = 0;
      }
    }, ENTRY_ANNOUNCE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  const handleReconnect = () => {
    wsRef.current?.close();
    setReconnectTrigger((n) => n + 1);
  };

  // Filter entries
  const filteredEntries = entries.filter((entry) => {
    if (!enabledLevels.includes(entry.level)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        entry.message.toLowerCase().includes(q) ||
        entry.tag.toLowerCase().includes(q) ||
        (entry.error?.message.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <>
      <header role="banner">
        <h1>ButterSwitch Log Viewer</h1>
        <StatusBar
          connected={connected}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          entries={filteredEntries}
          onReconnect={handleReconnect}
        />
      </header>

      <nav aria-label="Log controls" id="log-controls">
        <VisuallyHidden elementType="h2">Search and Filters</VisuallyHidden>
        <SearchBar
          value={search}
          onChange={setSearch}
          resultCount={filteredEntries.length}
          totalCount={entries.length}
        />
        <LevelFilter enabledLevels={enabledLevels} onChange={setEnabledLevels} />
      </nav>

      <main id="main-content">
        <VisuallyHidden elementType="h2" id="log-heading">
          Log Entries
        </VisuallyHidden>
        <LogTable
          entries={filteredEntries}
          totalCount={entries.length}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={setVisibleColumns}
          autoScroll={autoScroll}
        />
      </main>
    </>
  );
}

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(<App />);
}
