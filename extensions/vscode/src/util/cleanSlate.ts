
import { ExtensionContext } from "vscode";

/**
 * Clear all Gobi-related artifacts to simulate a brand new user
 */
export function cleanSlate(context: ExtensionContext) {
  // Commented just to be safe
  // // Remove ~/.gobi
  // const gobiPath = getGobiGlobalPath();
  // if (fs.existsSync(gobiPath)) {
  //   fs.rmSync(gobiPath, { recursive: true, force: true });
  // }
  // // Clear extension's globalState
  // context.globalState.keys().forEach((key) => {
  //   context.globalState.update(key, undefined);
  // });
}
