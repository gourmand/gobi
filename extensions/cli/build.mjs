#!/usr/bin/env node

import * as esbuild from "esbuild";
import { chmodSync, copyFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

// Parse command line arguments
const args = process.argv.slice(2);
const noMinify = args.includes("--no-minify");

const __dirname = dirname(fileURLToPath(import.meta.url));


const external = [
  "@sentry/profiling-node", // native profiler bindings (optional)
  "fsevents", // macOS native file watcher (optional dependency)
  "./xhr-sync-worker.js", // JSDOM worker file that needs to be copied separately
  // Keep commander external to avoid CJS->ESM transform leaving dynamic
  // require calls for builtins inside the bundle.
  "commander",
];

// Some modules contain top-level await or complex initialization that can
// confuse the bundler's generated helpers when inlined. Mark these as
// external so they are loaded at runtime from node_modules instead of being
// bundled into the single file. This keeps the bundle simpler and avoids
// syntax issues seen during execution.
external.push(
  "winston",
  "@sentry/node",
  "@sentry/profiling-node",
  "@opentelemetry/sdk-node",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/api",
  "posthog-node",
  "node-machine-id",
  "jsdom",
  "ink",
  "yoga-layout",
  "open" // Uses import.meta.url which doesn't work in CJS bundles
);

console.log("Building CLI with esbuild...");

// Plugin to handle optional react-devtools-core
const optionalDevtoolsPlugin = {
  name: "optional-devtools",
  setup(build) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => {
      // Return path to our stub instead of marking as external
      return { path: resolve(__dirname, "stubs/react-devtools-core.js") };
    });
  },
};

  try {
  const result = await esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: "node24",
    // Produce a CommonJS bundle so the generated code uses `require()` for
    // native modules and CJS-only dependencies. We'll emit `dist/index.cjs`
    // and create a small JS wrapper that requires it.
    format: "cjs",
    outfile: "dist/index.cjs",
    external,
    sourcemap: true,
    minify: !noMinify, // Use --no-minify flag to control minification
    metafile: true,
    plugins: [optionalDevtoolsPlugin], // Handle .js extensions in imports
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],

    // Handle TypeScript paths and local packages
    alias: {
      "@gourmanddev/config-yaml": resolve(
        __dirname,
        "../../packages/config-yaml/dist/index.js",
      ),
      "@gourmanddev/openai-adapters": resolve(
        __dirname,
        "../../packages/openai-adapters/dist/index.js",
      ),
      "@gourmanddev/config-types": resolve(
        __dirname,
        "../../packages/config-types/dist/index.js",
      ),
      "@gourmanddev/core": resolve(__dirname, "../../packages/core/dist"),
      "@gourmanddev/fetch": resolve(
        __dirname,
        "../../packages/fetch/dist/index.js",
      ),
      "@gourmanddev/llm-info": resolve(
        __dirname,
        "../../packages/llm-info/dist/index.js",
      ),
      "@gourmanddev/terminal-security": resolve(
        __dirname,
        "../../packages/terminal-security/dist/index.js",
      ),
      "@gourmanddev/sdk": resolve(
        __dirname,
        "../../packages/gobi-sdk/typescript/dist",
      ),
    },
  });

  // Write metafile for analysis
  writeFileSync("dist/meta.json", JSON.stringify(result.metafile, null, 2));

  // Create wrapper script with a node shebang that loads the CommonJS
  // bundle. We keep the wrapper as a small CJS-compatible file so that
  // `npm link` and bin consumers can `require()` the bundle directly.
  const requireWrapper = `#!/usr/bin/env node
try {
  require('./index.cjs');
} catch (err) {
  console.error(err);
  process.exit(1);
}
`;
  // Write as .cjs so Node treats the wrapper as CommonJS even in a
  // "type": "module" package. This ensures `require` is defined.
  writeFileSync("dist/gobi.cjs", requireWrapper);
  writeFileSync("dist/gi.cjs", requireWrapper);

  // Also provide a small ESM wrapper at dist/gobi.js that spawns Node to
  // run the CommonJS wrapper. This file uses a node shebang so it passes the
  // smoke-test that checks for a node shebang while still running the CJS
  // bundle under Node.
  const nodeSpawnWrapper = `#!/usr/bin/env node
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [join(__dirname, 'gobi.cjs'), ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code));
`;
  writeFileSync("dist/gobi.js", nodeSpawnWrapper);
  writeFileSync("dist/gi.js", nodeSpawnWrapper);
  // Copy worker files needed by JSDOM
  const workerSource = resolve(
    __dirname,
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
  );
  const workerDest = resolve(__dirname, "dist/xhr-sync-worker.js");
  try {
    copyFileSync(workerSource, workerDest);
    console.log("✓ Copied xhr-sync-worker.js");
  } catch (error) {
    console.warn("Warning: Could not copy xhr-sync-worker.js:", error.message);
  }

  // Make the wrapper scripts executable
  chmodSync("dist/gobi.js", 0o755);
  try {
    chmodSync("dist/gi.js", 0o755);
  } catch (err) {
    // ignore if not available
  }

  // Calculate bundle size
  const outKey = Object.keys(result.metafile.outputs).find((k) => k.endsWith("dist/index.cjs") || k.endsWith("dist/index.js"));
  const bundleSize = outKey ? result.metafile.outputs[outKey].bytes : 0;
  console.log(
    `✓ Build complete! Bundle size: ${(bundleSize / 1024 / 1024).toFixed(2)} MB`,
  );
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
