import {defineConfig} from "tsup";

export default defineConfig((opts) => ({
  entry: ["src"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node24",
  splitting: false,
  skipNodeModulesBundle: true,
}));