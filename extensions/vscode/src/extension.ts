/**
 * This is the entry point for the extension.
 */

import { setupCa } from "@gourmanddev/core/util/ca";
import { extractMinimalStackTraceInfo } from "@gourmanddev/core/util/extractMinimalStackTraceInfo";
import { Telemetry } from "@gourmanddev/core/util/posthog";
import * as vscode from "vscode";
import {
  disposeHttpInterceptor,
  initHttpInterceptor,
} from "./security/interceptor";

import { SentryLogger } from "@gourmanddev/core/util/sentry/SentryLogger";
import { getExtensionVersion } from "./util/util";
export { default as buildTimestamp } from "./.buildTimestamp";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  await setupCa();
  const { activateExtension } = await import("./activation/activate");
  return await activateExtension(context);
}

export function activate(context: vscode.ExtensionContext) {
  initHttpInterceptor();
  return dynamicImportAndActivate(context).catch((e) => {
    console.log("Error activating extension: ", e);
    Telemetry.capture(
      "vscode_extension_activation_error",
      {
        stack: extractMinimalStackTraceInfo(e.stack),
        message: e.message,
      },
      false,
      true,
    );
    vscode.window
      .showWarningMessage(
        "Error activating the Gobi extension.",
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          // The extension may have failed before it could register its commands.
          // Use the built-in VS Code command to show developer tools/logs so the
          // user can view logs even when our command isn't available yet.
          vscode.commands.executeCommand("workbench.action.toggleDevTools");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  });
}

export function deactivate() {
  disposeHttpInterceptor();
  void Telemetry.capture(
    "deactivate",
    {
      extensionVersion: getExtensionVersion(),
    },
    true,
  );

  Telemetry.shutdownPosthogClient();
  SentryLogger.shutdownSentryClient();
}
