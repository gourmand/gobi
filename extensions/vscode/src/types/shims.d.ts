// Minimal shims for ambient modules that lack types in this workspace

declare module "lodash" {
  const _default: any;
  export default _default;
}

// If other packages import web-tree-sitter directly from the extension sources,
// this duplicate declaration is compatible with the one under packages/core.
declare module "web-tree-sitter" {
  export class Parser {
    parse(code: string): any;
    parse(code: string, previousTree: any): any;
    static init(): Promise<void>;
  }
  // named exports to satisfy code that imports types directly
  export type SyntaxNode = any;
  export type Tree = any;
  export type QueryMatch = any;

  export default Parser;
}
