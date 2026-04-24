import { defineConfig } from "vitest/config";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: false, include: ["src"] })],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    sourcemap: true,
    minify: false,
  },
  test: {
    globals: true,
    include: ["__tests__/**/*.test.ts"],
  },
});
