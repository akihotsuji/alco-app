import { defineConfig } from "vitest/config";
import { srcAlias } from "./vite.alias.ts";

export default defineConfig({
  resolve: {
    alias: srcAlias,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
