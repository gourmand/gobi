import { workspace } from "vscode";

export const GOBI_WORKSPACE_KEY = "gobi";

export function getGobiWorkspaceConfig() {
  return workspace.getConfiguration(GOBI_WORKSPACE_KEY);
}
