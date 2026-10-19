import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { platformApi } from "./server/api.js";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "platform-api",
      configureServer(server) {
        server.middlewares.use(platformApi);
      },
      configurePreviewServer(server) {
        server.middlewares.use(platformApi);
      },
    },
  ],
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
