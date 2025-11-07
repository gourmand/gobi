declare module "web-tree-sitter" {
  // Minimal, permissive typings to satisfy project's use of tree-sitter types.
  // These are intentionally `any`-based to avoid coupling to a specific tree-sitter
  // version; refine if you want stricter types later.

  export class Parser {
    parse(code: string): Tree;
    parse(code: string, previousTree: Tree): Tree;
    static init(): Promise<void>;
  }

  export namespace Parser {
    export type SyntaxNode = any;
    export type Tree = any;
  }

  export type SyntaxNode = any;
  export type Tree = any;
  export type QueryMatch = any;

  export default Parser;
}
