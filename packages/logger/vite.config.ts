import { defineConfig } from "vitest/config";

// Type declarations are produced by a separate `tsc -p tsconfig.build.json`
// step (see package.json scripts), not via vite-plugin-dts.
// `vite-plugin-dts` with rollupTypes:true funneled declarations through
// api-extractor which produced a broken .d.ts on clean CI environments
// due to an internal TypeScript version mismatch; rollupTypes:false then
// produced declarations that CI's tsc couldn't locate at all.
// Running the official TypeScript compiler directly is predictable across
// every environment.
export default defineConfig({
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
