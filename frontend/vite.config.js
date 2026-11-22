import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, /api e /img vão para o back (uvicorn na porta 8000)
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/img": "http://127.0.0.1:8000",
    },
  },
});
