import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll("\\", "/");

          if (
            normalizedId.includes("vite/preload-helper") ||
            normalizedId.includes("/src/pages/Homepage") ||
            normalizedId.includes("/src/components/") ||
            normalizedId.includes("/src/data/defaultContent") ||
            normalizedId.includes("/src/hooks/") ||
            normalizedId.includes("/src/lib/contentTypes") ||
            normalizedId.includes("/src/lib/contentValidation") ||
            normalizedId.includes("/src/lib/formSubmit") ||
            normalizedId.includes("/src/lib/imageUtils") ||
            normalizedId.includes("/src/lib/seo") ||
            normalizedId.includes("/src/lib/serverContent") ||
            normalizedId.includes("/src/lib/storage") ||
            normalizedId.includes("/src/lib/studioRoute")
          ) {
            return "public-core";
          }

          if (
            normalizedId.includes("/src/pages/AdminPage") ||
            normalizedId.includes("/src/pages/StudioAuthPage") ||
            normalizedId.includes("/src/lib/cmsApi") ||
            normalizedId.includes("/src/lib/studioSecurity")
          ) {
            return "studio";
          }

        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 15_000,
    setupFiles: "./src/test/setup.ts",
    css: true,
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
