import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const lockfile = readFileSync(resolve(__dirname, "pnpm-lock.yaml"), "utf8");
const liteVersion = lockfile.match(/'@babylonjs\/lite':\r?\n\s+specifier:\s+([^\s]+)/)?.[1];

if (!liteVersion) {
  throw new Error("Could not read the @babylonjs/lite version from pnpm-lock.yaml.");
}

export default defineConfig({
  define: {
    __BABYLON_LITE_VERSION__: JSON.stringify(liteVersion),
  },
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
