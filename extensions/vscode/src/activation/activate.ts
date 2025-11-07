import { getGobiRcPath, getTsConfigPath } from "@gourmanddev/core/util/paths";
import { Telemetry } from "@gourmanddev/core/util/posthog";
import * as vscode from "vscode";

import { VsCodeExtension } from "../extension/VsCodeExtension";
import { getExtensionVersion, isUnsupportedPlatform } from "../util/util";

import { GlobalContext } from "@gourmanddev/core/util/GlobalContext";
import { VsCodeGobiApi } from "./api";
import setupInlineTips from "./InlineTipManager";

export async function activateExtension(context: vscode.ExtensionContext) {
  const platformCheck = isUnsupportedPlatform();
  const globalContext = new GlobalContext();
  const hasShownUnsupportedPlatformWarning = globalContext.get(
    "hasShownUnsupportedPlatformWarning",
  );

  if (platformCheck.isUnsupported && !hasShownUnsupportedPlatformWarning) {
    const platformTarget = "windows-arm64";

    globalContext.update("hasShownUnsupportedPlatformWarning", true);
    void vscode.window.showInformationMessage(
      `Gobi detected that you are using ${platformTarget}. Due to native dependencies, Gobi may not be able to start`,
    );

    void Telemetry.capture(
      "unsupported_platform_activation_attempt",
      {
        platform: platformTarget,
        extensionVersion: getExtensionVersion(),
        reason: platformCheck.reason,
      },
      true,
    );
  }

  // Add necessary files
  getTsConfigPath();
  getGobiRcPath();

  // Register commands and providers
  setupInlineTips(context);

  const vscodeExtension = new VsCodeExtension(context);

  // Load Gobi configuration
  if (!context.globalState.get("hasBeenInstalled")) {
    void context.globalState.update("hasBeenInstalled", true);
    void Telemetry.capture(
      "install",
      {
        extensionVersion: getExtensionVersion(),
      },
      true,
    );
  }

  // Register config.yaml schema by removing old entries and adding new one (uri.fsPath changes with each version)
  const yamlMatcher = ".gobi/**/*.yaml";
  const yamlConfig = vscode.workspace.getConfiguration("yaml");

  const newPath = vscode.Uri.joinPath(
    context.extension.extensionUri,
    "config-yaml-schema.json",
  ).toString();

  // Only attempt to update yaml.schemas if the configuration key is contributed in this host.
  // In lightweight or minimal VS Code instances the YAML extension may not be installed
  // and the `yaml.schemas` setting won't be registered, which causes update() to throw.
  try {
    if (typeof yamlConfig.has === "function" && yamlConfig.has("schemas")) {
      await yamlConfig.update(
        "schemas",
        { [newPath]: [yamlMatcher] },
        vscode.ConfigurationTarget.Global,
      );
    } else {
      // If the host doesn't expose the yaml.schemas setting, skip registration.
      // This keeps activation error-free in environments without the YAML extension.
      console.info(
        "Skipping Gobi config.yaml schema registration because 'yaml.schemas' is not available in this host.",
      );
    }
  } catch (error) {
    console.error(
      "Failed to register Gobi config.yaml schema, most likely, YAML extension is not installed",
      error,
    );
  }

  const api = new VsCodeGobiApi(vscodeExtension);
  const gobiPublicApi = {
    registerCustomContextProvider: api.registerCustomContextProvider.bind(api),
  };

  // 'export' public api-surface
  // or entire extension for testing
  return process.env.NODE_ENV === "test"
    ? {
        ...gobiPublicApi,
        extension: vscodeExtension,
      }
    : gobiPublicApi;
}
