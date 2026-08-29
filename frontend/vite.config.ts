import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "GOOGLE_CLIENT_ID"],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});
