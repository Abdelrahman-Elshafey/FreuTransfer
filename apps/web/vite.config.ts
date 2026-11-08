import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // In development, /api/* is forwarded to the Express API (apps/api, PORT in .env.example).
    // 127.0.0.1, not "localhost" (same reason as packages/db/src/local-dev.ts).
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
