import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

import { getTheme } from "./util/getTheme";
import { getExtensionVersion, getvsCodeUriScheme } from "./util/util";
import { getExtensionUri, getNonce, getUniqueId } from "./util/vscode";
import { VsCodeWebviewProtocol } from "./webviewProtocol";

import type { FileEdit } from "@gourmanddev/core";

export class GobiGUIWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gourmand.gobiGUIView";
  public webviewProtocol: VsCodeWebviewProtocol;

  public get isReady(): boolean {
    return !!this.webview;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void | Thenable<void> {
    this.webviewProtocol.webview = webviewView.webview;
    this._webviewView = webviewView;
    this._webview = webviewView.webview;
    webviewView.webview.html = this.getSidebarContent(
      this.extensionContext,
      webviewView,
    );
  }

  private _webview?: vscode.Webview;
  private _webviewView?: vscode.WebviewView;

  get isVisible() {
    return this._webviewView?.visible;
  }

  get webview() {
    return this._webview;
  }

  public resetWebviewProtocolWebview(): void {
    if (this._webview) {
      this.webviewProtocol.webview = this._webview;
    } else {
      console.warn("no webview found during reset");
    }
  }

  sendMainUserInput(input: string) {
    this.webview?.postMessage({
      type: "userInput",
      input,
    });
  }

  constructor(
    private readonly windowId: string,
    private readonly extensionContext: vscode.ExtensionContext,
  ) {
    this.webviewProtocol = new VsCodeWebviewProtocol();
  }

  getSidebarContent(
    context: vscode.ExtensionContext | undefined,
    panel: vscode.WebviewPanel | vscode.WebviewView,
    page: string | undefined = undefined,
    edits: FileEdit[] | undefined = undefined,
    isFullScreen = false,
  ): string {
    const extensionUri = getExtensionUri();
    let scriptUri: string;
    let styleMainUri: string;
    const vscMediaUrl: string = panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui"))
      .toString();

    // Always use the built/bundled assets inside the extension. We avoid
    // referencing a dev server (http://localhost) so the webview makes zero
    // external network calls and everything resolves via asWebviewUri.
    scriptUri = panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.js"))
      .toString();
    styleMainUri = panel.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.css"))
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

    const currentTheme = getTheme();
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("workbench.colorTheme") ||
        e.affectsConfiguration("window.autoDetectColorScheme") ||
        e.affectsConfiguration("window.autoDetectHighContrast") ||
        e.affectsConfiguration("workbench.preferredDarkColorTheme") ||
        e.affectsConfiguration("workbench.preferredLightColorTheme") ||
        e.affectsConfiguration("workbench.preferredHighContrastColorTheme") ||
        e.affectsConfiguration("workbench.preferredHighContrastLightColorTheme")
      ) {
        // Send new theme to GUI to update embedded Monaco themes
        this.webviewProtocol?.request("setTheme", { theme: getTheme() });
      }
    });

    this.webviewProtocol.webview = panel.webview;

    const htmlParts: string[] = [];
    htmlParts.push("<!DOCTYPE html>");
    htmlParts.push('<html lang="en">');
    htmlParts.push("<head>");
    htmlParts.push('<meta charset="UTF-8">');
    htmlParts.push(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    );
    htmlParts.push("<script>const vscode = acquireVsCodeApi();</script>");

    // Load and patch CSS on the extension host (synchronously) and inline it into the webview HTML.
    // This avoids doing a synchronous XHR from inside the webview which can fail with the
    // 'file+.vscode-resource.vscode-cdn.net' host rewriting in some environments.
    try {
      const cssFilePath = path.join(
        getExtensionUri().fsPath,
        "gui",
        "assets",
        "index.css",
      );
      if (fs.existsSync(cssFilePath)) {
        let css = fs.readFileSync(cssFilePath, "utf8");
        // Rewrite url(/...) to use the webview media root so absolute URLs in CSS resolve
        css = css.replace(/url\(\s*(["']?)\//g, `url($1${vscMediaUrl}/`);
        htmlParts.push('<style nonce="' + nonce + '">');
        htmlParts.push(css);
        htmlParts.push("</style>");
      } else {
        // Fallback: warn in the webview console instead of failing the page load
        htmlParts.push(
          '<script nonce="' +
            nonce +
            '">console.warn("Gobi: index.css not found on disk: ' +
            cssFilePath.replace(/"/g, '\\"') +
            '")</script>',
        );
      }
    } catch (e) {
      htmlParts.push(
        '<script nonce="' +
          nonce +
          '">console.warn("Failed to load patched CSS for webview: ' +
          JSON.stringify(String(e)) +
          '")</script>',
      );
    }

    htmlParts.push("<title>Gobi</title>");
    htmlParts.push("</head>");
    htmlParts.push("<body>");
    htmlParts.push('<div id="root"></div>');

    // Note: we deliberately avoid injecting HMR/dev runtime scripts via
    // http://localhost. If developers want HMR, they can open the GUI in a
    // browser or run the extension in a dev setup that copies the built
    // assets into the extension gui/ folder.

    htmlParts.push(
      '<script type="module" nonce="' +
        nonce +
        '" src="' +
        scriptUri +
        '"></script>',
    );

    htmlParts.push(
      '<script>localStorage.setItem("ide", "\\"vscode\\"")</script>',
    );
    htmlParts.push(
      '<script>localStorage.setItem("vsCodeUriScheme", "' +
        JSON.stringify(getvsCodeUriScheme()) +
        '")</script>',
    );
    htmlParts.push(
      '<script>localStorage.setItem("extensionVersion", "' +
        JSON.stringify(getExtensionVersion()) +
        '")</script>',
    );
    htmlParts.push(
      '<script>window.windowId = "' + this.windowId + '"</script>',
    );
    htmlParts.push(
      '<script>window.vscMachineId = "' + getUniqueId() + '"</script>',
    );
    htmlParts.push(
      '<script>window.vscMediaUrl = "' + vscMediaUrl + '"</script>',
    );
    htmlParts.push('<script>window.ide = "vscode"</script>');
    htmlParts.push(
      "<script>window.fullColorTheme = " +
        JSON.stringify(currentTheme) +
        "</script>",
    );
    htmlParts.push('<script>window.colorThemeName = "dark-plus"</script>');
    htmlParts.push(
      "<script>window.workspacePaths = " +
        JSON.stringify(
          vscode.workspace.workspaceFolders?.map((folder) =>
            folder.uri.toString(),
          ) || [],
        ) +
        "</script>",
    );
    htmlParts.push(
      "<script>window.isFullScreen = " +
        (isFullScreen ? "true" : "false") +
        "</script>",
    );

    if (edits) {
      htmlParts.push(
        "<script>window.edits = " + JSON.stringify(edits) + "</script>",
      );
    }
    if (page) {
      htmlParts.push(
        '<script>window.location.pathname = "' + page + '"</script>',
      );
    }

    htmlParts.push("</body>");
    htmlParts.push("</html>");

    return htmlParts.join("\n");
  }
}
