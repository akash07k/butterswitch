#!/usr/bin/env node
/**
 * CLI entry point for butterswitch-log-server.
 * Parses process.argv and delegates to {@link startServer}.
 */
import { parseCliArgs, startServer } from "./cli.js";

const options = parseCliArgs(process.argv.slice(2));
startServer(options);
