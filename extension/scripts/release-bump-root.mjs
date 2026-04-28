#!/usr/bin/env node
/**
 * @file release-bump-root.mjs
 *
 * release-it hook. Mirrors the just-bumped extension version onto
 * the root `package.json`, then stages both the root `package.json`
 * and the root `CHANGELOG.md` (which the conventional-changelog
 * plugin writes at repo root) so release-it's subsequent commit
 * step picks them up.
 *
 * release-it runs from `extension/`, so its built-in
 * `git add . --update` only sees changes inside that directory.
 * Anything at the repo root has to be staged explicitly here, or
 * it lands in the working tree post-release and the tag points to
 * a commit that does not include it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const EXTENSION_PKG = resolve(REPO_ROOT, "extension", "package.json");
const ROOT_PKG = resolve(REPO_ROOT, "package.json");

// Read the version that release-it just wrote into extension/package.json.
const extPkg = JSON.parse(readFileSync(EXTENSION_PKG, "utf8"));
const newVersion = extPkg.version;

if (typeof newVersion !== "string" || !newVersion) {
  process.stderr.write("[release-bump-root] extension/package.json has no version\n");
  process.exit(1);
}

// Mirror it into the root package.json if it differs.
const rootPkg = JSON.parse(readFileSync(ROOT_PKG, "utf8"));
if (rootPkg.version !== newVersion) {
  rootPkg.version = newVersion;
  writeFileSync(ROOT_PKG, JSON.stringify(rootPkg, null, 2) + "\n", "utf8");
  process.stdout.write(`[release-bump-root] Bumped root package.json to ${newVersion}\n`);
} else {
  process.stdout.write(`[release-bump-root] Root package.json already at ${newVersion}\n`);
}

// Stage the root files so release-it's commit picks them up.
execSync(`git -C "${REPO_ROOT}" add package.json CHANGELOG.md`, { stdio: "inherit" });
process.stdout.write("[release-bump-root] Staged root package.json and CHANGELOG.md\n");
