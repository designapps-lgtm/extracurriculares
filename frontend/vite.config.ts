import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "GOOGLE_CLIENT_ID"],
  server: {
    host: true,
    port: 5173,
    // Google Identity Services necesita conservar el vínculo con su popup.
    // Esta cabecera sólo se aplica al servidor de desarrollo de Vite.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});
