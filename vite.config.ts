import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  preview: {
    host: "0.0.0.0",
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
  build: {
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        app: resolve(__dirname, "index.html"),
        guide: resolve(__dirname, "user-guide.html"),
        "babylon-lite-preview": resolve(__dirname, "src/preview/babylon-lite-entry.js"),
      },
      output: {
        entryFileNames(chunk) {
          return chunk.name === "babylon-lite-preview" ? "assets/babylon-lite-preview.js" : "assets/[name]-[hash].js";
        },
      },
    },
  },
});
