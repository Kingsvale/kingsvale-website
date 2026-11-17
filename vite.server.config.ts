import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { ssr: "src/server-render.tsx", outDir: "dist/server-render", emptyOutDir: true, rollupOptions: { output: { entryFileNames: "index.js" } } }
});
