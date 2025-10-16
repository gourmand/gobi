import * as os from "os";
import * as path from "path";

import dotenv from "dotenv";

dotenv.config();

export const env = {
  apiBase: process.env.GOBI_API_BASE ?? "https://api.gourmand.dev/",
  workOsClientId:
    process.env.WORKOS_CLIENT_ID ?? "client_01K7N7M0JCX6X1PW4G4WPDF9Y3",
  appUrl: process.env.HUB_URL || "https://hub.gourmand.dev",
  gobiHome: process.env.GOBI_GLOBAL_DIR || path.join(os.homedir(), ".gobi"),
};
