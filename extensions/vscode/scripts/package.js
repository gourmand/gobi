const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
const version = pkg.version;

const args = process.argv.slice(2);
const isPreRelease = args.includes("--pre-release");
let target;

const tIdx = args.indexOf("--target");
if (tIdx !== -1 && args[tIdx + 1]) {
  target = args[tIdx + 1];
}

if (!fs.existsSync("build")) fs.mkdirSync("build");

const vsceArgs = ["package", "--out", "./build", "--no-dependencies"];
if (isPreRelease) vsceArgs.push("--pre-release");
if (target) vsceArgs.push("--target", target);

execFileSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "vsce", ...vsceArgs],
  {
    stdio: "inherit",
  },
);

console.log(
  `vsce package completed - extension created at extensions/vscode/build/gobi-${version}.vsix`,
);
