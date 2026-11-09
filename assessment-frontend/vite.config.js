import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  test: {
    environment: "jsdom",
    include: ["tests/components/**/*.test.js"],
    restoreMocks: true,
  },
});
