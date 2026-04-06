import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "src/web"),
  build: {
    outDir: resolve(__dirname, "dist/web"),
    emptyOutDir: true,
  },
});
