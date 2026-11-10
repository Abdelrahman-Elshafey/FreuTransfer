import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /v1/* goes to the Express API on its default port (apps/api/src/main.ts),
    // the same path production forwards to the API (docs/adr/0004), so the page uses one URL.
    // 127.0.0.1, not "localhost" (same reason as packages/db/src/local-dev.ts).
    proxy: { "/v1": "http://127.0.0.1:3000" },
  },
});
