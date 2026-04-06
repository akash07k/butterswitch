import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { Command } from "commander";
import { LogServer } from "./ws-server.js";
import { FileWriter } from "./file-writer.js";
import { formatForTerminal } from "./terminal-formatter.js";
import type { LogEntry } from "./types.js";

const LEVEL_MAP: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface CliOptions {
  port: number;
  file?: string;
  level: number;
  tag?: string;
  color: boolean;
}

/**
 * Parse CLI arguments into typed options.
 * Exported separately for testing without starting the server.
 */
export function parseCliArgs(argv: string[]): CliOptions {
  const program = new Command();

  program
    .name("butterswitch-log-server")
    .description("Accessible log viewer and WebSocket server for @butterswitch/logger")
    .version("0.0.1")
    .option("-p, --port <number>", "WebSocket port", "8089")
    .option("-f, --file <path>", "Also write logs to a file")
    .option(
      "-l, --level <level>",
      "Minimum level to display (debug, info, warn, error, fatal)",
      "debug",
    )
    .option("-t, --tag <prefix>", "Filter by tag prefix")
    .option("--color", "Enable colored output", false);

  program.parse(argv, { from: "user" });
  const opts = program.opts();

  return {
    port: Number(opts.port),
    file: opts.file as string | undefined,
    level: LEVEL_MAP[opts.level as string] ?? 0,
    tag: opts.tag as string | undefined,
    color: Boolean(opts.color),
  };
}

/**
 * Start the log server with the given options.
 */
export async function startServer(options: CliOptions): Promise<void> {
  // Resolve web viewer directory (built files next to CLI)
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const webDir = join(thisDir, "web");
  const hasWebViewer = existsSync(webDir);

  const server = new LogServer({ port: options.port, webDir: hasWebViewer ? webDir : undefined });
  const fileWriter = options.file ? new FileWriter(options.file) : null;

  server.on("entry", (entry: LogEntry) => {
    if (entry.level < options.level) return;
    if (options.tag && !entry.tag.startsWith(options.tag)) return;

    console.log(formatForTerminal(entry));
    server.broadcast(entry);

    if (fileWriter) {
      fileWriter.write(entry);
    }
  });

  const port = await server.start();
  console.log(`butterswitch-log-server listening on ws://localhost:${port}`);
  if (hasWebViewer) {
    console.log(`Web viewer: http://localhost:${port}`);
  }

  process.on("SIGINT", async () => {
    fileWriter?.close();
    await server.stop();
    process.exit(0);
  });
}
