import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "extension"),
  publicDir: resolve(__dirname, "extension/public"),
  build: {
    outDir: resolve(__dirname, "dist-extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        devtools: resolve(__dirname, "extension/devtools.html"),
        panel: resolve(__dirname, "extension/panel.html"),
        sidepanel: resolve(__dirname, "extension/sidepanel.html"),
        background: resolve(__dirname, "extension/src/background.js"),
        content: resolve(__dirname, "extension/src/content.js"),
        inpage: resolve(__dirname, "extension/src/inpage.js"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});
