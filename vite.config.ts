import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: "electron/main.ts",
      },
      {
        entry: "electron/preload.ts",
        onstart(args) {
          args.reload();
        },
      },
    ]),
    renderer(),
  ],

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
});
