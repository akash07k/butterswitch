// Store submission helper — resolves the zip paths under .output/ and
// hands them to `wxt submit` with the correct flags.
//
// Usage (from extension/):
//     pnpm submit:init      # one-time: writes .env.submit with store credentials
//     pnpm build && pnpm zip && pnpm zip:firefox   # produce the three zips
//     pnpm submit:dry-run   # verifies credentials without sending anything
//     pnpm submit           # submits for real
//
// Why a helper script: the .output/ zip filenames embed the extension
// name and version (e.g. butterswitch-extension-1.0.0-chrome.zip), so
// hardcoding paths in package.json would need a manual edit on every
// version bump. Node's readdir + filter is robust enough and avoids
// adding a shell-glob dependency that breaks on Windows cmd.

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const OUTPUT_DIR = ".output";

function fail(msg) {
  // process.stderr.write instead of console.error so the script needs
  // only the one `process` import (keeps the lint config simple).
  process.stderr.write(`[submit] ${msg}\n`);
  process.exit(1);
}

let files;
try {
  files = readdirSync(OUTPUT_DIR);
} catch {
  fail(`${OUTPUT_DIR}/ not found — run \`pnpm zip\` and \`pnpm zip:firefox\` first.`);
}

function findOne(suffix) {
  const match = files.filter((f) => f.endsWith(suffix));
  if (match.length === 0) {
    fail(`no ${suffix} under ${OUTPUT_DIR}/. Run the appropriate zip command first.`);
  }
  if (match.length > 1) {
    fail(
      `multiple ${suffix} under ${OUTPUT_DIR}/ (${match.join(", ")}). Remove stale builds or pass explicit paths to \`wxt submit\`.`,
    );
  }
  return resolve(OUTPUT_DIR, match[0]);
}

const chromeZip = findOne("-chrome.zip");
const firefoxZip = findOne("-firefox.zip");
const sourcesZip = findOne("-sources.zip");

const passthrough = process.argv.slice(2);

const wxtArgs = [
  "wxt",
  "submit",
  ...passthrough,
  "--chrome-zip",
  chromeZip,
  "--firefox-zip",
  firefoxZip,
  "--firefox-sources-zip",
  sourcesZip,
];

const result = spawnSync("pnpm", wxtArgs, { stdio: "inherit", shell: true });
process.exit(result.status ?? 0);
