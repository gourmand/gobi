import { IContextProvider } from "core";

import { VsCodeExtension } from "../extension/VsCodeExtension";

export class VsCodeGobiApi {
  constructor(private readonly vscodeExtension: VsCodeExtension) {}

  registerCustomContextProvider(contextProvider: IContextProvider) {
    this.vscodeExtension.registerCustomContextProvider(contextProvider);
  }
}
