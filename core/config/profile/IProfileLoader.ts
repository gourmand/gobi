// ProfileHandlers manage the loading of a config, allowing us to abstract over different ways of getting to a GobiConfig

import { ConfigResult } from "@gourmanddev/config-yaml";
import { GobiConfig } from "../../index.js";
import { ProfileDescription } from "../ProfileLifecycleManager.js";

// After we have the GobiConfig, the ConfigHandler takes care of everything else (loading models, lifecycle, etc.)
export interface IProfileLoader {
  description: ProfileDescription;
  doLoadConfig(): Promise<ConfigResult<GobiConfig>>;
  setIsActive(isActive: boolean): void;
}
