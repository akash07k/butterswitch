import { defineConfig } from "vitest/config";

/**
 * Root vitest config — aggregates every workspace so `pnpm test` at
 * the root runs the full suite (logger + log-server + extension).
 *
 * Each project's own vitest.config.ts drives its environment and
 * include patterns — extension uses jsdom for a11y/DOM helpers,
 * the two packages use Node. This file is the aggregator, not a
 * substitute for per-workspace configs.
 *
 * `pnpm -r test` (used by lefthook pre-push and CI) produces the
 * same test set via a different orchestration path. Keep both in
 * sync — dropping extension here would silently excuse 151 tests
 * from the root `pnpm test` command.
 */
export default defineConfig({
  test: {
    projects: ["packages/*", "extension"],
  },
});
