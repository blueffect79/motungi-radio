import { configDefaults, defineConfig } from "vitest/config";
export default defineConfig(({ command, mode }) => ({
  define: { __APP_STORE__: JSON.stringify(mode === "appstore") },
  resolve: {
    alias:
      command === "serve" && mode === "ui-preview"
        ? [
            {
              find: /^@tauri-apps\/api\/core$/,
              replacement: new URL("./src/dev/bridge.ts", import.meta.url)
                .pathname,
            },
          ]
        : [],
  },
  test: {
    exclude: [
      ...configDefaults.exclude,
      "**/.dryforge/**",
      "scripts/**/*.test.mjs",
    ],
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { outDir: mode === "appstore" ? "dist-appstore" : "dist", target: ["es2022", "safari16"] },
}));
