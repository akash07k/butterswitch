#!/usr/bin/env node
import { parseCliArgs, startServer } from "./cli.js";

const options = parseCliArgs(process.argv.slice(2));
startServer(options);
