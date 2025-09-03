import { defineConfig } from "vite";
import monkey, { cdn } from "vite-plugin-monkey";

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    legalComments: "none"
  },
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "Stream Watchtool",
        description:
          "Lets you highlight watched episoded and seasons. Also highlights Filler episodes on One Piece",
        namespace: "github/Johannes7k75/Stream-Watchtool",
        version: "1.0.4",
        match: ["*://*/anime/stream/*", "*://*/serie/stream/*"],
        icon: "https://vitejs.dev/logo.svg",
        grant: ["GM_getResourceText"],
        
        license: "MIT",
        resource: {
          "one-piece.json":
            "https://github.com/Johannes7k75/tapermonkey-user-scripts/releases/download/OnePieceFiller/one-piece.json",
        },
      },
    }),
  ],
});
