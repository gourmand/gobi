import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 'testTransformMode' was removed/renamed in newer Vitest typings.
    // Remove the option to match the current InlineConfig type.
    globalSetup: "./test/vitest.global-setup.ts",
    setupFiles: "./test/vitest.setup.ts",
    fileParallelism: false,
    include: ["**/*.vitest.ts"],
  },
});
