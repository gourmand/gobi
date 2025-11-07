const fs = require("fs");
const path = require("path");

const ncp = require("ncp").ncp;
const { rimrafSync } = require("rimraf");

const { copySqlite } = require("./download-copy-sqlite");
const { installAndCopyNodeModules } = require("./install-copy-nodemodule");
const {
  validateFilesPresent,
  autodetectPlatformAndArch,
  writeBuildTimestamp,
  gobiDir,
} = require("./utils");

// Clear folders that will be packaged to ensure clean slate
rimrafSync(path.join(__dirname, "..", "bin"));
rimrafSync(path.join(__dirname, "..", "out"));
fs.mkdirSync(path.join(__dirname, "..", "out", "node_modules"), {
  recursive: true,
});
const guiDist = path.join(__dirname, "..", "..", "..", "gui", "dist");
if (!fs.existsSync(guiDist)) {
  fs.mkdirSync(guiDist, { recursive: true });
}

const skipInstalls = process.env.SKIP_INSTALLS === "true";

// Get the target to package for
let target = undefined;
const args = process.argv;
if (args[2] === "--target") {
  target = args[3];
}

let os;
let arch;
if (target) {
  [os, arch] = target.split("-");
} else {
  [os, arch] = autodetectPlatformAndArch();
}

if (os === "alpine") {
  os = "linux";
}
if (arch === "armhf") {
  arch = "arm64";
}
target = `${os}-${arch}`;
console.log("[info] Using target: ", target);

const exe = os === "win32" ? ".exe" : "";

const isArmTarget =
  target === "darwin-arm64" ||
  target === "linux-arm64" ||
  target === "win32-arm64";

const isWinTarget = target?.startsWith("win");
const isLinuxTarget = target?.startsWith("linux");
const isMacTarget = target?.startsWith("darwin");

void (async () => {
  const startTime = Date.now();
  console.log(
    `[info] Packaging extension for target ${target} - started at ${new Date().toISOString()}`,
  );

  // Make sure we have an initial timestamp file
  writeBuildTimestamp();

  const extensionRoot = path.dirname(__dirname);
  const packagesRoot = path.join(
    path.dirname(path.dirname(extensionRoot)),
    "packages",
  );

  console.log(`extension root: ${extensionRoot}`);
  console.log(`packages root: ${packagesRoot}`);

  process.chdir(path.join(packagesRoot, "gui"));
  // Ensure the GUI dist exists. If tailwind/Vite build wasn't run, run a build
  // so CSS assets are produced into dist/assets. This avoids packaging a stale
  // extension/gui directory that lacks the compiled CSS after Tailwind changes.
  try {
    const distAssetsIndex = path.join(
      process.cwd(),
      "dist",
      "assets",
      "index.css",
    );
    if (!fs.existsSync(distAssetsIndex)) {
      console.log(
        "[info] GUI dist appears incomplete (missing index.css). Running 'pnpm build' in packages/gui...",
      );
      // Run the gui build in this packages/gui working directory
      const { execSync } = require("child_process");
      execSync("pnpm build", { stdio: "inherit" });
    }
  } catch (e) {
    console.warn("[warn] Failed to auto-build GUI dist:", e);
  }

  // Then copy over the dist folder to the VSCode extension //
  const vscodeGuiPath = path.join(extensionRoot, "gui");
  const guiAssetsPath = path.join(vscodeGuiPath, "assets");
  // Only copy GUI build output if destination is missing or empty. This avoids copying
  // the GUI on repeated runs when `pnpm -r build` already produced the files.
  const shouldCopyGui = (() => {
    try {
      if (!fs.existsSync(vscodeGuiPath)) return true;
      const files = fs.readdirSync(vscodeGuiPath);
      return !files || files.length === 0;
    } catch (e) {
      return true;
    }
  })();

  // Track timing for GUI copy. Declare start outside the block so we can
  // safely reference it later regardless of whether we actually copy.
  let vscodeCopyStart = undefined;
  if (shouldCopyGui) {
    rimrafSync(vscodeGuiPath);
    fs.mkdirSync(vscodeGuiPath, { recursive: true });
    vscodeCopyStart = Date.now();
    console.log(`[timer] Starting VSCode copy at ${new Date().toISOString()}`);
    await new Promise((resolve, reject) => {
      ncp("dist", vscodeGuiPath, (error) => {
        if (error) {
          console.log(
            "Error copying React app build to VSCode extension: ",
            error,
          );
          reject(error);
        } else {
          console.log("Copied gui build to VSCode extension");
          resolve();
        }
      });
    });
    console.log(
      `[timer] VSCode copy completed in ${Date.now() - vscodeCopyStart}ms`,
    );
    // Post-copy: ensure expected CSS filenames exist. Some build setups (Vite/Tailwind)
    // may emit hashed CSS filenames. If that happened, copy the emitted CSS to the
    // expected filenames so the extension can reference them deterministically.
    try {
      const assetFiles = fs.existsSync(guiAssetsPath)
        ? fs.readdirSync(guiAssetsPath)
        : [];

      const ensureCss = (expectedName, globMatcher) => {
        if (assetFiles.includes(expectedName)) return;
        // Find a candidate file matching the globMatcher (regex)
        const rx = new RegExp(globMatcher);
        const candidate = assetFiles.find(
          (f) => rx.test(f) && f.endsWith(".css"),
        );
        if (candidate) {
          const from = path.join(guiAssetsPath, candidate);
          const to = path.join(guiAssetsPath, expectedName);
          try {
            fs.copyFileSync(from, to);
            console.log(`[info] Copied ${candidate} -> ${expectedName}`);
          } catch (e) {
            console.warn(
              `[warn] Failed to copy ${candidate} -> ${expectedName}`,
              e,
            );
          }
        }
      };

      // Ensure main index.css
      ensureCss("index.css", "^index(\\..*)?\\.css$");
      // Ensure console CSS (some builds emit indexConsole.*.css)
      ensureCss("indexConsole.css", "^indexConsole(\\..*)?\\.css$");
      // (override applied after the copy block below so it's executed even when
      // we skip copying because extension/gui already exists)
    } catch (e) {
      console.warn("[warn] Error while normalizing GUI CSS filenames:", e);
    }
  } else {
    console.log(
      "Skipping GUI copy: extension/gui already exists and is non-empty",
    );
  }

  // Packaging-time CSS override: ensure canonical CSS is present in the
  // extension/gui assets regardless of whether we copied the GUI in this run.
  try {
    const repoRootIndexCss = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "index.old.css",
    );
    const targetCss = path.join(guiAssetsPath, "index.css");
    if (fs.existsSync(repoRootIndexCss) && fs.existsSync(guiAssetsPath)) {
      fs.copyFileSync(repoRootIndexCss, targetCss);
      console.log(
        "[info] Overwrote gui assets index.css with canonical index.old.css from repo root",
      );
    } else if (!fs.existsSync(repoRootIndexCss)) {
      console.log(
        "[info] No canonical index.old.css found at repo root; leaving generated CSS in place",
      );
    }
  } catch (e) {
    console.warn("[warn] Failed to apply packaging-time CSS override:", e);
  }

  if (!fs.existsSync(path.join("dist", "assets", "index.js"))) {
    throw new Error("gui build did not produce index.js");
  }
  if (!fs.existsSync(path.join("dist", "assets", "index.css"))) {
    throw new Error("gui build did not produce index.css");
  }
  // Console view assets (tailwind build may produce separate console styles)
  if (!fs.existsSync(path.join("dist", "assets", "indexConsole.js"))) {
    console.warn(
      "gui build did not produce indexConsole.js — continuing, but console view may be unstyled",
    );
  }
  if (!fs.existsSync(path.join("dist", "assets", "indexConsole.css"))) {
    console.warn(
      "gui build did not produce indexConsole.css — continuing, but console view may be unstyled",
    );
  }

  // Copy over native / wasm modules //
  process.chdir(extensionRoot);

  fs.mkdirSync("bin", { recursive: true });

  // onnxruntime-node
  const onnxCopyStart = Date.now();
  console.log(
    `[timer] Starting onnxruntime copy at ${new Date().toISOString()}`,
  );
  await new Promise((resolve, reject) => {
    ncp(
      path.join(packagesRoot, "core/node_modules/onnxruntime-node/bin"),
      path.join(extensionRoot, "bin"),
      {
        dereference: true,
      },
      (error) => {
        if (error) {
          console.warn("[info] Error copying onnxruntime-node files", error);
          reject(error);
        }
        resolve();
      },
    );
  });
  console.log(
    `[timer] onnxruntime copy completed in ${Date.now() - onnxCopyStart}ms`,
  );
  if (target) {
    // If building for production, only need the binaries for current platform
    try {
      if (!target.startsWith("darwin")) {
        rimrafSync(path.join(extensionRoot, "bin/napi-v3/darwin"));
      }
      if (!target.startsWith("linux")) {
        rimrafSync(path.join(extensionRoot, "bin/napi-v3/linux"));
      }
      if (!target.startsWith("win")) {
        rimrafSync(path.join(extensionRoot, "bin/napi-v3/win32"));
      }

      // Also don't want to include cuda/shared/tensorrt binaries, they are too large
      if (target.startsWith("linux")) {
        const filesToRemove = [
          "libonnxruntime_providers_cuda.so",
          "libonnxruntime_providers_shared.so",
          "libonnxruntime_providers_tensorrt.so",
        ];
        filesToRemove.forEach((file) => {
          const filepath = path.join(
            extensionRoot,
            "bin/napi-v3/linux/x64",
            file,
          );
          if (fs.existsSync(filepath)) {
            fs.rmSync(filepath);
          }
        });
      }
    } catch (e) {
      console.warn("[info] Error removing unused binaries", e);
    }
  }
  console.log("[info] Copied onnxruntime-node");

  // tree-sitter-wasm
  fs.mkdirSync("out", { recursive: true });

  await new Promise((resolve, reject) => {
    ncp(
      path.join(packagesRoot, "core/node_modules/tree-sitter-wasms/out"),
      path.join(extensionRoot, "out/tree-sitter-wasms"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] Error copying tree-sitter-wasm files", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  const filesToCopy = [
    "core/vendor/tree-sitter.wasm",
    "core/llm/llamaTokenizerWorkerPool.mjs",
    "core/llm/llamaTokenizer.mjs",
    "core/llm/tiktokenWorkerPool.mjs",
    "core/util/start_ollama.sh",
  ];

  for (const f of filesToCopy) {
    fs.copyFileSync(
      path.join(packagesRoot, f),
      path.join(extensionRoot, "out", path.basename(f)),
    );
    console.log(`[info] Copied ${path.basename(f)}`);
  }

  // tree-sitter tag query files
  // ncp(
  //   path.join(
  //     __dirname,
  //     "../../../core/node_modules/llm-code-highlighter/dist/tag-qry",
  //   ),
  //   path.join(__dirname, "../out/tag-qry"),
  //   (error) => {
  //     if (error)
  //       console.warn("Error copying code-highlighter tag-qry files", error);
  //   },
  // );

  // textmate-syntaxes
  await new Promise((resolve, reject) => {
    ncp(
      path.join(extensionRoot, "textmate-syntaxes"),
      path.join(extensionRoot, "gui/textmate-syntaxes"),
      (error) => {
        if (error) {
          console.warn("[error] Error copying textmate-syntaxes", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  if (!skipInstalls) {
    // GitHub Actions doesn't support ARM, so we need to download pre-saved binaries
    // 02/07/25 - the above comment is out of date, there is now support for ARM runners on GitHub Actions
    if (isArmTarget) {
      // lancedb binary
      const packageToInstall = {
        "darwin-arm64": "@lancedb/vectordb-darwin-arm64",
        "linux-arm64": "@lancedb/vectordb-linux-arm64-gnu",
        "win32-arm64": "@lancedb/vectordb-win32-arm64-msvc",
      }[target];
      console.log(
        "[info] Downloading pre-built lancedb binary: " + packageToInstall,
      );

      await Promise.all([
        copySqlite(target),
        installAndCopyNodeModules(packageToInstall, "@lancedb"),
      ]);
    }
  }

  console.log("[info] Copying sqlite node binding from core");
  const sqliteSrc = path.join(packagesRoot, "core/node_modules/sqlite3/build");
  if (!fs.existsSync(sqliteSrc)) {
    throw new Error(
      `[error] sqlite3 build not found at expected path: ${sqliteSrc}. Ensure packages are installed and sqlite3 has been built under packages/core/node_modules/sqlite3/build`,
    );
  }

  await new Promise((resolve, reject) => {
    ncp(
      sqliteSrc,
      path.join(extensionRoot, "out/build"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] Error copying sqlite3 files", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  // Copied here as well for the VS Code test suite
  await new Promise((resolve, reject) => {
    ncp(
      sqliteSrc,
      path.join(extensionRoot, "out"),
      { dereference: true },
      (error) => {
        if (error) {
          console.warn("[error] Error copying sqlite3 files", error);
          reject(error);
        } else {
          resolve();
        }
      },
    );
  });

  // Copy node_modules for pre-built binaries
  const NODE_MODULES_TO_COPY = ["@lancedb", "@vscode/ripgrep", "workerpool"];

  fs.mkdirSync("out/node_modules", { recursive: true });

  await Promise.all(
    NODE_MODULES_TO_COPY.map(
      (mod) =>
        new Promise((resolve, reject) => {
          fs.mkdirSync(`out/node_modules/${mod}`, { recursive: true });
          ncp(
            `node_modules/${mod}`,
            `out/node_modules/${mod}`,
            { dereference: true },
            function (error) {
              if (error) {
                console.error(`[error] Error copying ${mod}`, error);
                reject(error);
              } else {
                console.log(`[info] Copied ${mod}`);
                resolve();
              }
            },
          );
        }),
    ),
  );

  console.log(`[info] Copied ${NODE_MODULES_TO_COPY.join(", ")}`);

  // Copy over any worker files
  fs.cpSync(
    "node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js",
    "out/xhr-sync-worker.js",
  );

  // Copy jsdom's default stylesheet (required by jsdom@27+)
  // Try to locate jsdom's default stylesheet. pnpm/workspace setups may hoist
  // jsdom outside the extension folder, so prefer require.resolve to find the
  // actual installed package, and fall back to the path under extensionRoot.
  let jsdomStylesheetSrc = path.join(
    extensionRoot,
    "node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css",
  );
  try {
    const resolvedJsdom = require.resolve("jsdom");
    const resolvedDir = path.dirname(resolvedJsdom);
    const candidate = path.join(
      resolvedDir,
      "browser",
      "default-stylesheet.css",
    );
    if (fs.existsSync(candidate)) {
      jsdomStylesheetSrc = candidate;
    }
  } catch (e) {
    // ignore and fall back to extensionRoot path
  }
  // Place the default stylesheet where extension.js expects it:
  // extensions/build/extension.js loads '../../browser/default-stylesheet.css'
  const jsdomStylesheetDest = path.join(
    extensionRoot,
    "browser",
    "default-stylesheet.css",
  );
  try {
    if (fs.existsSync(jsdomStylesheetSrc)) {
      fs.mkdirSync(path.dirname(jsdomStylesheetDest), { recursive: true });
      fs.cpSync(jsdomStylesheetSrc, jsdomStylesheetDest);
      console.log(
        "[info] Copied jsdom default-stylesheet.css to browser/default-stylesheet.css",
      );
    } else {
      console.warn(
        "[warn] jsdom default-stylesheet.css not found at expected location",
      );
    }
  } catch (e) {
    console.warn("[warn] Failed to copy jsdom default-stylesheet.css:", e);
  }

  // Validate the all of the necessary files are present
  validateFilesPresent([
    // Queries used to create the index for @code context provider
    "tree-sitter/code-snippet-queries/c_sharp.scm",

    // Queries used for @outline and @highlights context providers
    "tag-qry/tree-sitter-c_sharp-tags.scm",

    // onnx runtime bindngs
    `bin/napi-v6/${os}/${arch}/onnxruntime_binding.node`,
    `bin/napi-v6/${os}/${arch}/${
      isMacTarget
        ? "libonnxruntime.1.23.2.dylib"
        : isLinuxTarget
          ? "libonnxruntime.so.1"
          : "onnxruntime.dll"
    }`,

    // Code/styling for the sidebar and console
    "gui/assets/index.js",
    "gui/assets/index.css",
    // Console view assets (may be produced separately by Tailwind/Vite)
    "gui/assets/indexConsole.js",
    "gui/assets/indexConsole.css",

    // Tutorial
    "gobi_tutorial.py",
    "config_schema.json",

    // Embeddings model
    "models/all-MiniLM-L6-v2/config.json",
    "models/all-MiniLM-L6-v2/special_tokens_map.json",
    "models/all-MiniLM-L6-v2/tokenizer_config.json",
    "models/all-MiniLM-L6-v2/tokenizer.json",
    "models/all-MiniLM-L6-v2/vocab.txt",
    "models/all-MiniLM-L6-v2/onnx/model_quantized.onnx",

    // node_modules (it's a bit confusing why this is necessary)
    `node_modules/@vscode/ripgrep/bin/rg${exe}`,

    // out directory (where the extension.js lives)
    // "out/extension.js", This is generated afterward by vsce
    // web-tree-sitter
    "out/tree-sitter.wasm",
    // Worker required by jsdom
    "out/xhr-sync-worker.js",
    // SQLite3 Node native module
    "out/build/Release/node_sqlite3.node",

    // out/node_modules (to be accessed by extension.js)
    `out/node_modules/@vscode/ripgrep/bin/rg${exe}`,
    `out/node_modules/@lancedb/vectordb-${target}${isWinTarget ? "-msvc" : ""}${isLinuxTarget ? "-gnu" : ""}/index.node`,
  ]);

  console.log(
    `[timer] Prepackage completed in ${Date.now() - startTime}ms - finished at ${new Date().toISOString()}`,
  );
  process.exit(0);
})();
