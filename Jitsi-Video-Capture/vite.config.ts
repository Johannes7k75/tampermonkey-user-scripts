import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";
import { version } from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    legalComments: "none",
  },
  plugins: [
    monkey({
      entry: "src/JitsiVideoCapture.ts",
      userscript: {
        name: "Jitsi Video Capture Suite (Timer & Templates)",
        description:
          "Adds recording with live duration timer, screenshots, and custom naming templates to Jitsi video tiles",
        namespace: "github/Johannes7k75/Jitsi-Video-Capture",
        version: version,
        match: ["https://meet.jit.si/*"],
        include: ["/^https://jitsi\.[^/]*?/.*?$/"],
        grant: ["GM_setValue", "GM_getValue", "GM_registerMenuCommand", "GM_log", "GM_download"],
        license: "MIT",
      },
    }),
  ],
});
