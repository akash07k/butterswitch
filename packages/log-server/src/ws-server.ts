import { EventEmitter } from "node:events";
import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";
import type { LogEntry } from "./types.js";

export interface LogServerConfig {
  /** Port to listen on. Use 0 for a random available port. */
  port: number;
  /** Directory containing built web viewer files. If unset, no web UI is served. */
  webDir?: string;
  /** Max entries to keep in memory for replay to new clients (default: 1000) */
  bufferSize?: number;
}

const DEFAULT_BUFFER_SIZE = 1000;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".map": "application/json",
};

/**
 * WebSocket server that receives JSON log entries from clients.
 * Emits "entry" events for each parsed log entry.
 * Optionally serves a static web viewer over HTTP on the same port.
 */
export class LogServer extends EventEmitter {
  private readonly config: LogServerConfig;
  private readonly bufferSize: number;
  private readonly entryBuffer: LogEntry[] = [];
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  constructor(config: LogServerConfig) {
    super();
    this.config = config;
    this.bufferSize = config.bufferSize ?? DEFAULT_BUFFER_SIZE;
  }

  /** Number of currently connected WebSocket clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Start the server. Returns the actual port (useful when port is 0). */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req, res) => this.handleHttp(req, res));
      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on("connection", (ws) => {
        this.clients.add(ws);

        // Replay buffered entries to new clients
        for (const entry of this.entryBuffer) {
          ws.send(JSON.stringify(entry));
        }

        ws.on("message", (data) => {
          try {
            const entry = JSON.parse(data.toString()) as LogEntry;
            this.emit("entry", entry);
          } catch {
            // Ignore invalid JSON — don't crash the server
          }
        });

        ws.on("close", () => {
          this.clients.delete(ws);
        });
      });

      this.httpServer.on("error", reject);

      this.httpServer.listen(this.config.port, () => {
        const addr = this.httpServer!.address();
        const port = typeof addr === "object" && addr ? addr.port : this.config.port;
        resolve(port);
      });
    });
  }

  /** Stop the server and disconnect all clients. */
  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => resolve());
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /** Broadcast a log entry to all connected WebSocket clients and buffer for replay. */
  broadcast(entry: LogEntry): void {
    // Buffer for new clients that connect later
    this.entryBuffer.push(entry);
    if (this.entryBuffer.length > this.bufferSize) {
      this.entryBuffer.shift();
    }

    const json = JSON.stringify(entry);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(json);
      }
    }
  }

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    if (!this.config.webDir) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("butterswitch-log-server is running. No web viewer built.");
      return;
    }

    const url = req.url === "/" ? "/index.html" : (req.url ?? "/index.html");
    const filePath = join(this.config.webDir, url);

    if (!existsSync(filePath)) {
      // SPA fallback — serve index.html for unknown routes
      const indexPath = join(this.config.webDir, "index.html");
      if (existsSync(indexPath)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(readFileSync(indexPath));
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(readFileSync(filePath));
  }
}
