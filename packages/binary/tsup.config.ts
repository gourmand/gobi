import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node24",
  sourcemap: true,
  clean: true,
  splitting: false,
  outDir: "out",
  noExternal: ["/^@gourmanddev\//"],
  external: ["sqlite3", "win-ca"],
  loader: {
    ".wasm": "file",
    ".mjs": "file",
  },
  banner: { js: "#!/usr/bin/env node" },
});
