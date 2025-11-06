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

    const inDevelopmentMode =
      context?.extensionMode === vscode.ExtensionMode.Development;
    if (!inDevelopmentMode) {
      scriptUri = panel.webview
        .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.js"))
        .toString();
      styleMainUri = panel.webview
        .asWebviewUri(vscode.Uri.joinPath(extensionUri, "gui/assets/index.css"))
        .toString();
    } else {
      scriptUri = "http://localhost:5173/src/main.tsx";
      styleMainUri = "http://localhost:5173/src/index.css";
    }

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
    // Synchronously fetch and patch CSS so fonts and absolute paths resolve inside the webview
    htmlParts.push('<script nonce="' + nonce + '">(function(){');
    htmlParts.push("try{");
    htmlParts.push(
      "var __gobi_media_root=" + JSON.stringify(vscMediaUrl) + ";",
    );
    htmlParts.push(
      'var xhr=new XMLHttpRequest();xhr.open("GET",' +
        JSON.stringify(styleMainUri) +
        ",false);xhr.send(null);",
    );
    htmlParts.push(
      "if(xhr.status===200){var css=xhr.responseText;css=css.replace(/url\\(\\s*([\"\"])?\\//g,'url($1' + __gobi_media_root + '/');var style=document.createElement('style');style.type='text/css';try{style.appendChild(document.createTextNode(css))}catch(e){style.innerHTML=css}document.head.appendChild(style)}",
    );
    htmlParts.push(
      "}catch(e){console.warn('Failed to load patched CSS for webview',e);} })();</script>",
    );

    htmlParts.push("<title>Gobi</title>");
    htmlParts.push("</head>");
    htmlParts.push("<body>");
    htmlParts.push('<div id="root"></div>');

    if (inDevelopmentMode) {
      htmlParts.push('<script type="module">');
      htmlParts.push(
        'import RefreshRuntime from "http://localhost:5173/@react-refresh"',
      );
      htmlParts.push("RefreshRuntime.injectIntoGlobalHook(window)");
      htmlParts.push("window.$RefreshReg$ = () => {}");
      htmlParts.push("window.$RefreshSig$ = () => (type) => type");
      htmlParts.push("window.__vite_plugin_react_preamble_installed__ = true");
      htmlParts.push("</script>");
    }

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
