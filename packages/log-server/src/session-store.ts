import {
  mkdirSync,
  appendFileSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { LogEntry } from "./types.js";

export interface SessionStoreConfig {
  /** Directory for session files (default: ~/.butterswitch-logs) */
  logDir?: string;
  /** Max session files to keep (default: 50) */
  maxSessions?: number;
}

export interface SessionInfo {
  /** Session filename (without path) */
  filename: string;
  /** Session start time as ISO string */
  startedAt: string;
  /** Number of entries in the session */
  entryCount: number;
}

const DEFAULT_LOG_DIR = join(homedir(), ".butterswitch-logs", "sessions");
const DEFAULT_MAX_SESSIONS = 50;

/**
 * Persists log entries to per-session JSONL files.
 * Each server start creates a new session file.
 * Old sessions are auto-cleaned based on maxSessions.
 */
export class SessionStore {
  private readonly logDir: string;
  private readonly maxSessions: number;
  private readonly sessionFile: string;
  private readonly sessionId: string;
  private entryCount = 0;

  constructor(config: SessionStoreConfig = {}) {
    this.logDir = config.logDir ?? DEFAULT_LOG_DIR;
    this.maxSessions = config.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    this.sessionFile = join(this.logDir, `${this.sessionId}.jsonl`);

    mkdirSync(this.logDir, { recursive: true });
    this.cleanOldSessions();
  }

  /** Append an entry to the current session file. */
  append(entry: LogEntry): void {
    appendFileSync(this.sessionFile, JSON.stringify(entry) + "\n");
    this.entryCount++;
  }

  /** List all available sessions, newest first. */
  listSessions(): SessionInfo[] {
    if (!existsSync(this.logDir)) return [];

    return readdirSync(this.logDir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse()
      .map((filename) => {
        const filePath = join(this.logDir, filename);
        const content = readFileSync(filePath, "utf-8").trim();
        const entryCount = content ? content.split("\n").length : 0;

        return {
          filename,
          startedAt: this.filenameToDate(filename),
          entryCount,
        };
      });
  }

  /** Load all entries from a specific session file. */
  loadSession(filename: string): LogEntry[] {
    const filePath = join(this.logDir, filename);
    if (!existsSync(filePath)) return [];

    const content = readFileSync(filePath, "utf-8").trim();
    if (!content) return [];

    return content.split("\n").map((line) => JSON.parse(line) as LogEntry);
  }

  /** Get the current session filename. */
  get currentSessionFile(): string {
    return `${this.sessionId}.jsonl`;
  }

  /** Get the current session entry count. */
  get currentEntryCount(): number {
    return this.entryCount;
  }

  private filenameToDate(filename: string): string {
    // Filename format: 2026-03-31T02-30-00-000Z.jsonl
    // Restore to: 2026-03-31T02:30:00.000Z
    const base = filename.replace(".jsonl", "");
    const parts = base.split("T");
    if (parts.length !== 2) return base;
    const timePart = parts[1]!
      .replace(/-/g, ":")
      .replace(/:(\d{3})Z$/, ".$1Z")
      .replace(/:(\d{3})$/, ".$1");
    return `${parts[0]}T${timePart}`;
  }

  private cleanOldSessions(): void {
    if (!existsSync(this.logDir)) return;

    const files = readdirSync(this.logDir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort();

    const excess = files.length - this.maxSessions;
    if (excess <= 0) return;

    for (let i = 0; i < excess; i++) {
      unlinkSync(join(this.logDir, files[i]!));
    }
  }
}
