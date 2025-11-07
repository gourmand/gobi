import type { SyntaxNode } from "web-tree-sitter";

export function findInAst(
  node: SyntaxNode,
  criterion: (node: SyntaxNode) => boolean,
  shouldRecurse: (node: SyntaxNode) => boolean = () => true,
): SyntaxNode | null {
  const stack = [node];
  while (stack.length > 0) {
    let node = stack.pop()!;
    if (criterion(node)) {
      return node;
    }

    if (shouldRecurse(node)) {
      stack.push(...node.children);
    }
  }
  return null;
}
