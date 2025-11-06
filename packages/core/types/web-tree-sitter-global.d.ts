declare module "web-tree-sitter" {
  // Simple permissive fallback for the web-tree-sitter module so that the
  // package can build while we iteratively tighten types in the codebase.
  const Parser: any;
  export default Parser;

  export type SyntaxNode = any;
  export type Tree = any;
  export type Query = any;
  export type QueryMatch = any;
  export type Point = any;
  export type Language = any;

  export const init: any;
}

// Provide a global namespace shortcut so code that references `Parser.SyntaxNode`
// without importing the module still type-checks during the migration.
declare namespace Parser {
  type SyntaxNode = any;
  type Tree = any;
  type Query = any;
  type QueryMatch = any;
  type Point = any;
  type Language = any;
}
