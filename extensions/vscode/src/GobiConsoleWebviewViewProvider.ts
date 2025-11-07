import { LLMInteractionItem } from "@gourmanddev/core";
import { EXTENSION_NAME } from "@gourmanddev/core/control-plane/env";
import { LLMLogger } from "@gourmanddev/core/llm/logger";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { getExtensionUri, getNonce } from "./util/vscode";

interface FromConsoleView {
  type: "start" | "stop";
  uuid: string;
}

// Maximum interactions we retain; when we exceed this, we drop the
// oldest and also send a message to the view to do the same.
const MAX_INTERACTIONS = 50;

export class GobiConsoleWebviewViewProvider
  implements vscode.WebviewViewProvider
{
  public static readonly viewType = "gourmand.gobiConsoleView";

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this._webviewView = webviewView;
    this._webview = webviewView.webview;
    this._webviewView.onDidDispose(() => {
      this._webviewView = undefined;
      this._webview = undefined;
    });
    webviewView.webview.html = this.getSidebarContent(
      this.extensionContext,
      webviewView,
    );
    this._webview.onDidReceiveMessage((message: FromConsoleView) => {
      if (message.type === "start") {
        this._currentUuid = message.uuid;
        this._webview?.postMessage({
          type: "init",
          uuid: this._currentUuid,
          items: this.getAllItems(),
        });
      }
    });
    this._webviewView.onDidDispose(() => {
      this._webview = undefined;
      this._webviewView = undefined;
      this._currentUuid = undefined;
    });
  }

  private _webview?: vscode.Webview;
  private _webviewView?: vscode.WebviewView;
  private _currentUuid?: string;
  private _currentInteractions = new Map<string, LLMInteractionItem[]>();
  private _completedInteractions: LLMInteractionItem[][] = [];
  private _saveLog;

  constructor(
    private readonly windowId: string,
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly llmLogger: LLMLogger,
  ) {
    const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
    this._saveLog = config.get<boolean>("enableConsole");

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(`${EXTENSION_NAME}.enableConsole`)) {
        const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
        this._saveLog = config.get<boolean>("enableConsole");
        if (!this._saveLog) {
          this.clearLog();
        }
      }
    });

    llmLogger.onLogItem((item) => this.addItem(item));
  }

  private addItem(item: LLMInteractionItem) {
    if (!this._saveLog) {
      return;
    }

    let iteractionItems = this._currentInteractions.get(item.interactionId);
    if (iteractionItems === undefined) {
      iteractionItems = [];
      this._currentInteractions.set(item.interactionId, iteractionItems);
    }

    iteractionItems.push(item);
    switch (item.kind) {
      case "success":
      case "cancel":
      case "error":
        this._completedInteractions.push(iteractionItems);
        this._currentInteractions.delete(item.interactionId);
        break;
      default:
        break;
    }

    if (this._currentUuid) {
      this._webview?.postMessage({
        type: "item",
        uuid: this._currentUuid,
        item,
      });
    }

    while (
      this._completedInteractions.length > 0 &&
      this._completedInteractions.length + this._currentInteractions.size >
        MAX_INTERACTIONS
    ) {
      let toRemove = this._completedInteractions.shift();
      this._webview?.postMessage({
        type: "remove",
        uuid: this._currentUuid,
        interactionId: toRemove![0].interactionId,
      });
    }
  }

  private getAllItems() {
    let items = this._completedInteractions.flat();

    for (const interactionItems of this._currentInteractions.values()) {
      items.push(...interactionItems);
    }

    return items;
  }

  clearLog() {
    this._completedInteractions = [];
    this._currentInteractions = new Map();

    if (this._currentUuid) {
      this._webview?.postMessage({
        type: "clear",
        uuid: this._currentUuid,
      });
    }
  }

  private getSidebarContent(
    context: vscode.ExtensionContext | undefined,
    panel: vscode.WebviewPanel | vscode.WebviewView,
    page: string | undefined = undefined,
  ): string {
    const extensionUri = getExtensionUri();
    let scriptUri: string;
    let styleMainUri: string;

    // Always use the built/bundled assets from the installed extension. Do
    // not reference a dev server — the webview should have zero external
    // network calls and should load everything from local extension files.
    scriptUri = panel.webview
      .asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "gui/assets/indexConsole.js"),
      )
      .toString();
    styleMainUri = panel.webview
      .asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "gui/assets/indexConsole.css"),
      )
      .toString();

    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, "gui"),
        vscode.Uri.joinPath(extensionUri, "assets"),
      ],
      enableCommandUris: true,
      portMapping: [
        {
          webviewPort: 65433,
          extensionHostPort: 65433,
        },
      ],
    };

    const nonce = getNonce();

    // Inline CSS from the extension's bundled assets (preferred). If that
    // isn't available (for some developer setups), try a couple of likely
    // fallback paths in the workspace. If none are found, fall back to
    // linking the asWebviewUri (still local to the installed extension).
    let inlineCss: string | undefined = undefined;
    try {
      const extensionUri = getExtensionUri();
      const candidates = [
        path.join(extensionUri.fsPath, "gui", "assets", "indexConsole.css"),
        // possible relative paths when running from source tree
        path.join(
          extensionUri.fsPath,
          "..",
          "..",
          "gui",
          "dist",
          "assets",
          "indexConsole.css",
        ),
        path.join(
          extensionUri.fsPath,
          "..",
          "..",
          "..",
          "gui",
          "dist",
          "assets",
          "indexConsole.css",
        ),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          inlineCss = fs.readFileSync(p, "utf8");
          break;
        }
      }
    } catch (e) {
      console.warn("Failed to read console CSS for inlining", e);
      inlineCss = undefined;
    }

    const cssBlock = inlineCss
      ? `<style nonce="${nonce}">${inlineCss.replace(/url\(\s*(["']?)\//g, `url($1${panel.webview.asWebviewUri(vscode.Uri.joinPath(getExtensionUri(), "gui")).toString()}/`)}</style>`
      : `<link href="${panel.webview.asWebviewUri(vscode.Uri.joinPath(getExtensionUri(), "gui", "assets", "indexConsole.css")).toString()}" rel="stylesheet">`;

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script>const vscode = acquireVsCodeApi();</script>
        ${cssBlock}

        <title>Gobi</title>
      </head>
      <body>
        <div id="root"></div>

        ${""}
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>`;
  }
}
