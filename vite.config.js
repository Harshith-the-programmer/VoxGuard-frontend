import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/backend": {
        target: "http://localhost:8081",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/backend/, "/api")
      },
      "/ai": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/ai/, "")
      }
    }
  }
});
