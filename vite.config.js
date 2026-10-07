import { defineConfig } from "vite";
import postcss from "./postcss.config.js";
import react from "@vitejs/plugin-react";
import { scheduleApiPlugin } from "./server/schedule-api.mjs";

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    postcss,
  },
  plugins: [react(), scheduleApiPlugin()],
  resolve: {
    extensions: [".js", ".mjs", ".jsx", ".json"],
    alias: [
      {
        find: /^~.+/,
        replacement: (val) => {
          return val.replace(/^~/, "");
        },
      },
    ],
  },
  build: {
    // commonjsOptions: {
    //   transformMixedEsModules: true,
    // }
  },
});
