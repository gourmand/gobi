/**
 * Ambient declarations for `web-tree-sitter` covering the subset used in
 * this repository. Types are intentionally permissive but explicit so code
 * referencing Parser.SyntaxNode, Parser.QueryMatch, Parser.Point, etc. compiles.
 */

declare namespace WebTreeSitter {
  export type Point = { row: number; column: number };

  export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    childCount: number;
    namedChildCount: number;
    children: SyntaxNode[];
    namedChildren: SyntaxNode[];
    parent?: SyntaxNode | null;
    nextSibling?: SyntaxNode | null;
    previousSibling?: SyntaxNode | null;
    // utility methods commonly used in repo
    descendantForPosition?(point: Point): SyntaxNode | null;
    descendantsOfType?(type: string): SyntaxNode[];
    childForFieldName?(name: string): SyntaxNode | null;
    equals?(other: SyntaxNode): boolean;
  }

  // The concrete Tree object from the runtime contains several utility
  // methods. We keep the shape permissive to avoid tight coupling with the
  // concrete runtime signature used by different tree-sitter builds.
  export interface Tree {
    rootNode: SyntaxNode;
    // allow other runtime properties/methods
    [key: string]: any;
  }

  export interface QueryCapture {
    name: string;
    node: SyntaxNode;
  }

  export interface QueryMatch {
    id: number;
    captures: QueryCapture[];
  }

  export interface Query {
    matches(node: SyntaxNode): QueryMatch[];
  }

  export interface Language {
    // opaque runtime language object
  }

  export interface ParserInstance {
    parse(input: string): Tree;
    setLanguage(lang: Language | null): void;
    getLanguage?(): Language | null;
  }
}

declare module "web-tree-sitter" {
  // Export a runtime value that is constructible (used as `new Parser()`),
  // and also has static helpers such as `init` and `Language.load`.
  // The shape is intentionally permissive to cover the repository usage.
  const Parser: {
    new (): WebTreeSitter.ParserInstance;
    prototype: WebTreeSitter.ParserInstance;
    init(): Promise<void>;
    Language: {
      load(path: string): Promise<WebTreeSitter.Language>;
    };
  };

  export default Parser;

  // Also export the commonly used types at module level so callers can import them
  // directly, and provide a namespace merge so `Parser.Tree` and similar still work.
  export type SyntaxNode = WebTreeSitter.SyntaxNode;
  export type Tree = WebTreeSitter.Tree;
  export type Query = WebTreeSitter.Query;
  export type QueryMatch = WebTreeSitter.QueryMatch;
  export type Point = WebTreeSitter.Point;
  export type Language = WebTreeSitter.Language;
  export const init: typeof Parser.init;

  export namespace Parser {
    export type SyntaxNode = WebTreeSitter.SyntaxNode;
    export type Tree = WebTreeSitter.Tree;
    export type Query = WebTreeSitter.Query;
    export type QueryMatch = WebTreeSitter.QueryMatch;
    export type Point = WebTreeSitter.Point;
    export type Language = WebTreeSitter.Language;
  }
}
