import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:4176", locale: "he-IL" },
  webServer: {
    command: "npm run dev -- --port 4176 --strictPort",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
  },
});
