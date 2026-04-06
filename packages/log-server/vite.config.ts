import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    ssr: resolve(__dirname, "src/bin.ts"),
    outDir: "dist",
    rollupOptions: {
      external: ["ws", "commander", "node:events", "node:http", "node:fs", "node:path", "node:os"],
    },
  },
  test: {
    globals: true,
    include: ["__tests__/**/*.test.ts"],
  },
});
