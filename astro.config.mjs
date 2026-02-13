// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://astro.build",
  base: "/",
  output: "server",

  adapter: cloudflare({
    imageService: "passthrough",
  }),

  i18n: {
    locales: ["es", "en", "pt-br", "zh-cn"],
    defaultLocale: "en",
  },

  vite: {
    build: {
      minify: false,
    },

    plugins: [tailwindcss()],
  },
});
