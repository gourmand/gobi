import { globalAgent } from "https";

// @ts-ignore
import { systemCertsAsync } from "system-ca";

export async function setupCa() {
  try {
    switch (process.platform) {
      case "darwin":
        // https://www.npmjs.com/package/mac-ca#usage
        {
          const macCa = await import("mac-ca");
          macCa.addToGlobalAgent();
        }
        break;
      case "win32":
        // Prefer the VS Code supported package, then fall back to win-ca, then to system-ca.
        // This keeps compatibility with our previous packaging while allowing the newer
        // @vscode/windows-ca-certs package to be used when available.
        try {
          const vscodeWinCa = await import("@vscode/windows-ca-certs");
          // The package exposes `getCerts()` returning PEM, or a helper to register.
          if (typeof vscodeWinCa.addToAgent === "function") {
            // hypothetical helper
            vscodeWinCa.addToAgent(globalAgent);
          } else if (typeof vscodeWinCa.getCerts === "function") {
            const pem = await vscodeWinCa.getCerts();
            if (pem) globalAgent.options.ca = pem;
          } else {
            // If the API differs, attempt to use default export as a function.
            const def = vscodeWinCa.default || vscodeWinCa;
            if (typeof def === "function") {
              const result = await def();
              if (result) globalAgent.options.ca = result;
            }
          }
        } catch (vscErr) {
          // If the vscode package isn't available, fall back to win-ca, then system-ca.
          // Suppress noisy module-not-found errors and only warn on other failures.
          const _vscErr: any = vscErr;
          const isNotFound =
            (_vscErr &&
              (_vscErr.code === "ERR_MODULE_NOT_FOUND" ||
                _vscErr.code === "MODULE_NOT_FOUND")) ||
            (_vscErr &&
              typeof _vscErr.message === "string" &&
              _vscErr.message.includes("@vscode/windows-ca-certs"));
          try {
            const winCa = await import("win-ca");
            winCa.inject("+");
          } catch (winErr) {
            if (!isNotFound) {
              console.warn(
                "@vscode/windows-ca-certs failed to load and win-ca failed as a fallback:",
                vscErr,
                winErr,
              );
            }
            try {
              globalAgent.options.ca = await systemCertsAsync();
            } catch (sysErr) {
              console.warn("Failed to load system CA as fallback:", sysErr);
            }
          }
        }
        break;
      default:
        // https://www.npmjs.com/package/system-ca
        globalAgent.options.ca = await systemCertsAsync();
        break;
    }
  } catch (e) {
    console.warn("Failed to setup CA: ", e);
  }
}
