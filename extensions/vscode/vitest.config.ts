import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.vitest.ts", "src/**/**.vitest.ts", "src/**/**.test.ts"],
    environment: "node",
    setupFiles: ["src/testSetup.ts"],
  },
  resolve: {
    alias: {
      // Redirect svg-builder to local shims to avoid ESM directory import issues in tests
      "svg-builder": path.resolve(
        __dirname,
        "src/testShims/svg-builder-shim.ts",
      ),
      "svg-builder/dist/esm/content": path.resolve(
        __dirname,
        "src/testShims/svg-builder-content-shim.ts",
      ),
    },
  },
});
