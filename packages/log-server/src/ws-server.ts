import { EventEmitter } from "node:events";
import { createServer, type Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { LogEntry } from "./types.js";

export interface LogServerConfig {
  /** Port to listen on. Use 0 for a random available port. */
  port: number;
}

/**
 * WebSocket server that receives JSON log entries from clients.
 * Emits "entry" events for each parsed log entry.
 */
export class LogServer extends EventEmitter {
  private readonly config: LogServerConfig;
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();

  constructor(config: LogServerConfig) {
    super();
    this.config = config;
  }

  /** Number of currently connected WebSocket clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Start the server. Returns the actual port (useful when port is 0). */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer();
      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on("connection", (ws) => {
        this.clients.add(ws);

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
}
