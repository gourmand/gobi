#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Colors for output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  reset: "\x1b[0m",
};

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
  process.stdout.write(`Testing ${name}... `);
  try {
    testFn();
    console.log(`${colors.green}✓${colors.reset}`);
    testsPassed++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset}`);
    console.error(`  Error: ${error.message}`);
    testsFailed++;
  }
}

function execCommand(command, options = {}) {
  return execSync(command, {
    cwd: __dirname,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });
}

console.log("🧪 Running smoke tests for bundled CLI (Node " + process.versions.node + ")...\n");

// Test 1: Check if expected outputs exist
runTest("Outputs exist", () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
  const binPath = resolve(__dirname, pkg.bin.gobi);
  if (!existsSync(binPath)) {
    throw new Error(`${pkg.bin.gobi} not found`);
  }
  // ESM main for library consumers
  if (!existsSync(resolve(__dirname, "dist/index.js"))) {
    throw new Error("dist/index.js not found");
  }
  // Legacy shim for compatibility
  if (!existsSync(resolve(__dirname, "dist/gobi.js"))) {
    throw new Error("dist/gobi.js not found");
  }
});

// Test 2: Check if binaries have shebangs
runTest("Binaries have shebang", () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
  const binCjs = readFileSync(resolve(__dirname, pkg.bin.gobi), "utf8");
  if (!binCjs.startsWith("#!/usr/bin/env node")) {
    throw new Error("gobi.cjs missing shebang");
  }
  const legacy = readFileSync(resolve(__dirname, "dist/gobi.js"), "utf8");
  if (!legacy.startsWith("#!/usr/bin/env node")) {
    throw new Error("gobi.js missing shebang");
  }
});

// Cross-platform command execution helper
function getCLICommand(args = "") {
  const isWindows = process.platform === "win32";
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
  const gobi = pkg.bin.gobi || "dist/gobi.cjs";
  const cmd = isWindows ? `node ${gobi}` : `./${gobi}`;
  return `${cmd} ${args}`.trim();
}

// Test 3: Version command works
runTest("Version command", () => {
  const output = execCommand(getCLICommand("--version"));
  const packageJson = JSON.parse(
    readFileSync(resolve(__dirname, "package.json"), "utf8"),
  );
  if (!output.includes(packageJson.version)) {
    throw new Error(
      `Version mismatch. Expected ${packageJson.version}, got: ${output}`,
    );
  }
});

// Test 4: Help command works
runTest("Help command", () => {
  const output = execCommand(getCLICommand("--help"));
  if (!output.includes("Gobi CLI") || !output.includes("--version")) {
    throw new Error("Help output missing expected content");
  }
});

// Test 5: Check bundle size
runTest("Bundle size is reasonable", () => {
  // Check the executable bundle size (gobi.cjs)
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
  const bundle = resolve(__dirname, pkg.bin.gobi);
  const buf = readFileSync(bundle);
  const sizeInMB = buf.length / (1024 * 1024);
  console.log(`(${sizeInMB.toFixed(1)}M)`);
  if (sizeInMB > 30) {
    throw new Error(`Bundle too large: ${sizeInMB.toFixed(1)}M`);
  }
});

// Test 6: Check that local packages are bundled
runTest("CLI runs without missing modules", () => {
  const output = execCommand(`${getCLICommand("--version")} 2>&1`, {
    env: { ...process.env, NODE_ENV: "production" },
  });
  if (
    output.includes("Cannot find module") ||
    output.includes("MODULE_NOT_FOUND")
  ) {
    throw new Error("Missing module detected in output");
  }
});

// Test 7: Test that the CLI can be invoked programmatically
runTest("CLI can be invoked", () => {
  try {
    // Test that the CLI runs without crashing when given no args
    const isWindows = process.platform === "win32";
    const nullDevice = isWindows ? "nul" : "/dev/null";
    execCommand(`${getCLICommand("--help")} > ${nullDevice} 2>&1`);
  } catch (error) {
    throw new Error(`CLI invocation failed: ${error.message}`);
  }
});

// Test 8: Check metadata file
runTest("Build metadata exists", () => {
  if (!existsSync(resolve(__dirname, "dist/meta.json"))) {
    throw new Error("dist/meta.json not found");
  }

  const meta = JSON.parse(
    readFileSync(resolve(__dirname, "dist/meta.json"), "utf8"),
  );
  if (!meta.inputs || !meta.outputs) {
    throw new Error("Invalid metadata structure");
  }
});

// Test 9: Verify no missing external dependencies
runTest("No missing runtime dependencies", () => {
  // This would fail in Test 3 if dependencies were missing, but let's be explicit
  const output = execCommand(`${getCLICommand("--version")} 2>&1`, {
    env: { ...process.env, NODE_ENV: "production" },
  });

  if (
    output.includes("Cannot find module") ||
    output.includes("MODULE_NOT_FOUND")
  ) {
    throw new Error("Missing module detected in output");
  }
});

// Test 10: Test npm link scenario
runTest("CLI works via node execution", () => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
    const output = execCommand(`node ${pkg.bin.gobi} --version 2>&1`);
    const packageJson = JSON.parse(
      readFileSync(resolve(__dirname, "package.json"), "utf8"),
    );
    if (!output.includes(packageJson.version)) {
      throw new Error("Version not found when running via node");
    }
  } catch (error) {
    throw new Error(`node execution scenario failed: ${error.message}`);
  }
});

// Summary
console.log("\n" + "=".repeat(50));
if (testsFailed === 0) {
  console.log(
    `${colors.green}✅ All ${testsPassed} tests passed!${colors.reset}`,
  );
  process.exit(0);
} else {
  console.log(
    `${colors.red}❌ ${testsFailed} test(s) failed, ${testsPassed} passed${colors.reset}`,
  );
  process.exit(1);
}
