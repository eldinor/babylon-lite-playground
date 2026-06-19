import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  },
});
