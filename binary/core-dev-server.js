const path = require("path");
process.env.GOBI_DEVELOPMENT = true;

process.env.GOBI_GLOBAL_DIR = path.join(
  process.env.PROJECT_DIR,
  "extensions",
  ".gobi-debug",
);

require("./out/index.js");
