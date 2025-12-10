import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import {version} from "./package.json"

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    legalComments: "none",
  },
  plugins: [
    monkey({
      entry: "src/main.ts",
      userscript: {
        name: "Stream Watchtool",
        description: "Lets you highlight watched episoded and seasons. Also highlights Filler episodes on One Piece",
        namespace: "github/Johannes7k75/Stream-Watchtool",
        version: version,
        match: ["*://*/anime/stream/*", "*://*/serie/stream/*"],
        icon: "https://vitejs.dev/logo.svg",
        grant: ["GM_getResourceText"],

        license: "MIT",
        resource: {
          "fillers.json": "https://github.com/Johannes7k75/tampermonkey-user-scripts/releases/download/AniWorld-Filler/fillers.json",
        },
      },
    }),
  ],
});
