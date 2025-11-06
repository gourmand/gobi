import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  rmSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";
import unzipper from "unzipper";

const TARGET = process.env.TARGET || "linux-x64";
const NODE_MAJOR = process.env.NODE_MAJOR || "24";
const NODE_VERSION = process.env.NODE_VERSION || `${NODE_MAJOR}.0.0`;
const tmp = path.join(tmpdir(), `gobi-build-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

const isTargetWindows = (() => {
  return TARGET.startsWith("windows");
})();

const isTargetMac = (() => {
  return TARGET.startsWith("darwin");
})();

const isTargetLinux = (() => {
  return TARGET.startsWith("linux");
})();

const root = path.dirname(fileURLToPath(import.meta.url));
console.log("--------------------------");
console.log(`root dir: ${root}`);
console.log("--------------------------");
const nodeDir = path.join(root, "node_modules");
console.log(`nodeDir: ${nodeDir}`);
console.log("--------------------------");
const outDir = path.join(root, "out");
const binDir = path.join(root, "bin", TARGET);
const binName = isTargetWindows ? "gobi.exe" : "gobi";
const binFile = path.join(binDir, binName);

const getTargetFiles = () => {
  const nodeBase = `https://nodejs.org/dist/v${NODE_VERSION}`;
  const vectorBase = path.join(nodeDir, "@lancedb");
  const map = {
    "linux-x64": {
      nodeUrl: `${nodeBase}/node-v${NODE_VERSION}-linux-x64.tar.xz`,
      vectorFile: path.join(vectorBase, "vectordb-linux-x64-gnu", "index.node"),
    },
    "linux-arm64": {
      nodeUrl: `${nodeBase}/node-v${NODE_VERSION}-linux-arm64.tar.xz`,
      vectorFile: path.join(
        vectorBase,
        "vectordb-linux-arm64-gnu",
        "index.node",
      ),
    },
    "darwin-x64": {
      nodeUrl: `${nodeBase}/node-v${NODE_VERSION}-darwin-x64.tar.gz`,
      vectorFile: path.join(vectorBase, "vectordb-darwin-x64", "index.node"),
    },
    "darwin-arm64": {
      nodeUrl: `${nodeBase}/node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
      vectorFile: path.join(vectorBase, "vectordb-darwin-arm64", "index.node"),
    },
    "windows-x64": {
      nodeUrl: `${nodeBase}/node-v${NODE_VERSION}-win-x64.zip`,
      vectorFile: path.join(
        vectorBase,
        "vectordb-win32-x64-msvc",
        "index.node",
      ),
    },
  };
  if (!Object.keys(map).includes(TARGET)) {
    throw new Error(
      `Invalid build target: ${TARGET} must be one of ${JSON.stringify(Object.keys(map))}`,
    );
  }
  return map[TARGET];
};

const download = async (url, dest) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  await pipeline(res.body, createWriteStream(dest));
};

const extractNode = async (archive, destExe) => {
  if (isTargetWindows) {
    await new Promise((res, rej) => {
      unzipper.Open.file(archive)
        .then((d) => {
          const entry = d.files.find(
            (f) => f.path.endsWith("/node.exe") || f.path === "node.exe",
          );
          if (!entry)
            return rej(new Error(`node.exe not found in archive ${archive}.`));
          mkdirSync(path.dirname(destExe), { recursive: true });
        })
        .catch(rej);
    });
  } else {
    console.log("--------------------------");
    console.log("extracting node binary to temp directory");
    console.log("--------------------------");
    const tarFlags = isTargetLinux ? ["-xJf"] : ["-xzf"];
    execFileSync("tar", [tarFlags, archive, "-C", tmp], {
      stdio: "inherit",
    });

    console.log(`$ ls ${tmp}`);
    console.log(JSON.stringify(readdirSync(tmp)));
    console.log("--------------------------");

    const nodeBinary = execFileSync(
      "find",
      [tmp, "-type", "f", "-name", "node"],
      { encoding: "utf-8" },
    )
      .split("\n")
      .find((f) => f.trim().endsWith("/bin/node"));

    if (!nodeBinary)
      throw new Error("Could not locate downloaded node binary.");
    console.log(`nodeBinary: ${nodeBinary}`);
    console.log("--------------------------");
    copyFileSync(nodeBinary.trim(), destExe);
    console.log(`copied nodeBinary: ${nodeBinary.trim()} -> ${binDir}`);

    // direct
    // const tarOpts = archive.endsWith(".tar.xz") ? ["-xJ"] : ["-xz"];
    // execFileSync(
    //   "bash",
    //   [
    //     "-lc",
    //     `mkdir -p ${binDir} && tar ${tarOpts} -f "${archive}" --wildcards '*/bin/node' --to-stdout > "${destExe}"`,
    //   ],
    //   { stdio: "inherit" },
    // );
  }
};

const copyAssets = () => {
  const wasmDir = path.join(outDir, "tree-sitter-wasms");
  mkdirSync(wasmDir);
  const coreDir = path.join(nodeDir, "@gourmanddev", "core");
  const coreModulesDir = path.join(coreDir, "node_modules");
  const wasmSrc = path.join(coreModulesDir, "tree-sitter-wasms", "out");
  for (const wasm of readdirSync(wasmSrc)) {
    copyFileSync(path.join(wasmSrc, wasm), path.join(wasmDir, wasm));
  }
  copyFileSync(
    path.join(coreDir, "vendor", "tree-sitter.wasm"),
    path.join(outDir, "tree-sitter.wasm"),
  );
  copyFileSync(
    path.join(
      coreModulesDir,
      "jsdom",
      "lib",
      "jsdom",
      "living",
      "xhr",
      "xhr-sync-worker.js",
    ),
    path.join(outDir, "xhr-sync-worker.js"),
  );
  copyFileSync(
    path.join(coreDir, "llm", "tiktokenWorkerPool.mjs"),
    path.join(outDir, "tiktokenWorkerPool.mjs"),
  );
  copyFileSync(
    path.join(coreDir, "llm", "llamaTokenizerWorkerPool.mjs"),
    path.join(outDir, "llamaTokenizerWorkerPool.mjs"),
  );
  copyFileSync(
    path.join(coreDir, "llm", "llamaTokenizer.mjs"),
    path.join(outDir, "llamaTokenizer.mjs"),
  );

  const sqLiteNodeFile = path.join(
    nodeDir,
    "sqlite3",
    "build",
    "Release",
    "node_sqlite3.node",
  );
  const sqLiteDest = path.join(outDir, "sqlite3");
  mkdirSync(sqLiteDest, { recursive: true });
  copyFileSync(sqLiteNodeFile, path.join(sqLiteDest, "node_sqlite3.node"));

  const vectorFile = getTargetFiles().vectorFile;
  const vectorDest = path.join(outDir, "lancedb");

  mkdirSync(vectorDest, { recursive: true });
  copyFileSync(vectorFile, path.join(vectorDest, "vector.node"));

  if (isTargetWindows) {
    const winCaSrcDir = path.join(nodeDir, "win-ca", "lib");
    const winCaDestDir = path.join(outDir, "win-ca");
    mkdirSync(winCaDestDir, { recursive: true });
    const winCaFiles = ["crypt32-ia32.node", "crypt32-x64.node", "roots.exe"];
    for (const caFile of winCaFiles) {
      copyFileSync(
        path.join(winCaSrcDir, caFile),
        path.join(winCaDestDir, caFile),
      );
    }
  }
};

const copyAssetsToBin = () => {
  console.log("copyAssetsToBin");
  const sqliteBin = path.join(binDir, "sqlite3");
  mkdirSync(sqliteBin, { recursive: true });
  copyFileSync(
    path.join(outDir, "sqlite3", "node_sqlite3.node"),
    path.join(sqliteBin, "node_sqlite3.node"),
  );
  const wasmDir = path.join(binDir, "tree-sitter-wasms");
  mkdirSync(wasmDir, { recursive: true });
  for (const wasm of readdirSync(path.join(outDir, "tree-sitter-wasms"))) {
    copyFileSync(
      path.join(outDir, "tree-sitter-wasms", wasm),
      path.join(wasmDir, wasm),
    );
  }
  const rootFiles = [
    "tree-sitter.wasm",
    "llamaTokenizer.mjs",
    "tiktokenWorkerPool.mjs",
    "llamaTokenizerWorkerPool.mjs",
    "xhr-sync-worker.js",
  ];
  for (const file of rootFiles) {
    copyFileSync(path.join(outDir, file), path.join(binDir, file));
  }
  const winCaDir = path.join(outDir, "win-ca");
  if (existsSync(winCaDir)) {
    const winCaDest = path.join(binDir, "win-ca");
    mkdirSync(winCaDest, { recursive: true });
    for (const file of readdirSync(winCaDir)) {
      copyFileSync(path.join(winCaDir, file), path.join(winCaDest, file));
    }
  }
};

const main = async () => {
  console.log("-------------------------");
  console.log("Preparing clean build...");
  console.log("-------------------------");
  if (existsSync(outDir)) rmSync(outDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  if (existsSync(binDir)) rmSync(binDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  console.log("-------------------------");
  console.log("Removed files from previous build...");
  console.log("-------------------------");

  execFileSync("pnpm", ["tsup:build"], { stdio: "inherit" });
  copyAssets();
  execFileSync("pnpm", ["run", "sea:blob"], { stdio: "inherit" });

  const url = getTargetFiles().nodeUrl;
  const archive = path.join(
    tmp,
    `node-${TARGET.replace("/", "-")}.${isTargetWindows ? ".zip" : isTargetMac ? ".tar.gz" : "tar.xz"}`,
  );
  await download(url, archive);
  await extractNode(archive, binFile);

  const postjectArgs = [
    binFile,
    "NODE_SEA_BLOB",
    "out/sea-prep.blob",
    "--sentinel-fuse",
    "NODE_SEA_FUSE",
  ];
  if (isTargetMac) postjectArgs.push("--macho-segment-name", "NODE_SEA");
  execFileSync("pnpm", ["exec", "postject", ...postjectArgs], {
    stdio: "inherit",
  });
  copyAssetsToBin();
};

main()
  .then(() => {
    rmSync(tmp, { recursive: true });
    console.log("Build completed successfully.");
  })
  .catch((err) => console.error(err.message));
