import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentHistoryTracker } from "./DocumentHistoryTracker";

// Mock Tree class that implements the Tree interface
class MockTree {
  rootNode = {
    type: "program",
    text: "mock-root-node",
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
    startIndex: 0,
    endIndex: 0,
    childCount: 0,
    namedChildCount: 0,
    children: [],
    namedChildren: [],
    parent: null,
    nextSibling: null,
    previousSibling: null,
    child: () => null,
    namedChild: () => null,
    descendantForPosition: () => null,
    descendantsOfType: () => [],
    childForFieldName: () => null,
    equals: () => false,
  };
  copy() {
    return new MockTree();
  }
  delete() {}
  rootNodeWithOffset() {
    return this.rootNode;
  }
  language = {} as any; // Mock Language object
  walk() {
    return {} as any;
  }
  edit() {}
  printDotGraph() {}
  getEditedRange() {
    return {} as any;
  }
  getChangedRanges() {
    return [];
  }
  getIncludedRanges() {
    return [];
  }
  getLanguage() {
    return this.language;
  }
  [key: string]: any; // Allow any additional properties
}

// Mock the web-tree-sitter module
vi.mock("web-tree-sitter", () => {
  const MockParser = class {
    parse() {
      return new MockTree();
    }
    setLanguage() {}
    getLanguage() {
      return "mock-language";
    }
  };

  // Add Tree as a property of MockParser
  (MockParser as any).Tree = MockTree;

  return {
    default: MockParser,
    Parser: {
      Tree: MockTree,
    },
  };
});

describe("DocumentHistoryTracker", () => {
  let tracker: DocumentHistoryTracker;
  let mockAst1: MockTree;
  let mockAst2: MockTree;
  const testDocPath = "/test/document.ts";
  const testContent1 = "const x = 1;";
  const testContent2 = "const x = 2;";

  beforeEach(() => {
    // Reset singleton instance for each test
    // @ts-ignore - accessing private static property for testing
    DocumentHistoryTracker.instance = null;
    tracker = DocumentHistoryTracker.getInstance();

    // Create mock ASTs
    mockAst1 = new MockTree();
    mockAst2 = new MockTree();
  });

  afterEach(() => {
    // Clear the tracker after each test
    tracker.clearMap();
  });

  describe("getInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = DocumentHistoryTracker.getInstance();
      const instance2 = DocumentHistoryTracker.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("addDocument", () => {
    it("should add a document to the tracker", () => {
      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);

      const ast = tracker.getMostRecentAst(testDocPath);
      const content = tracker.getMostRecentDocumentHistory(testDocPath);

      expect(ast).toBe(mockAst1);
      expect(content).toBe(testContent1);
    });
  });

  describe("push", () => {
    it("should push a new AST to an existing document's history stack", () => {
      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);
      tracker.push(testDocPath, testContent2, mockAst2 as any);

      const ast = tracker.getMostRecentAst(testDocPath);
      const content = tracker.getMostRecentDocumentHistory(testDocPath);

      expect(ast).toBe(mockAst2);
      expect(content).toBe(testContent2);
    });

    it("should add a document if it doesn't exist when pushing", () => {
      tracker.push(testDocPath, testContent1, mockAst1 as any);

      // Check if document was actually added
      const ast = tracker.getMostRecentAst(testDocPath);
      expect(ast).toBe(mockAst1);
    });
  });

  describe("getMostRecentAst", () => {
    it("should return the most recent AST of a document", () => {
      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);
      tracker.push(testDocPath, testContent2, mockAst2 as any);

      const ast = tracker.getMostRecentAst(testDocPath);

      expect(ast).toBe(mockAst2);
    });

    it("should return null if the document doesn't exist", () => {
      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const ast = tracker.getMostRecentAst("nonexistent-path");

      expect(ast).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Document nonexistent-path not found in AST tracker",
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null if the document has no ASTs", () => {
      // This test would require modifying private properties
      // So we'll mock an empty array situation
      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);

      // @ts-ignore - accessing private property for testing
      tracker.documentAstMap.set(testDocPath, []);

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const ast = tracker.getMostRecentAst(testDocPath);

      expect(ast).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Document ${testDocPath} has no ASTs`,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getMostRecentDocumentHistory", () => {
    it("should return the most recent document history", () => {
      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);
      tracker.push(testDocPath, testContent2, mockAst2 as any);

      const content = tracker.getMostRecentDocumentHistory(testDocPath);

      expect(content).toBe(testContent2);
    });

    it("should return null if the document doesn't exist", () => {
      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const content = tracker.getMostRecentDocumentHistory("nonexistent-path");

      expect(content).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Document nonexistent-path not found in AST tracker",
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null if the document has no history", () => {
      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);

      // @ts-ignore - accessing private property for testing
      tracker.documentContentHistoryMap.set(testDocPath, []);

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const content = tracker.getMostRecentDocumentHistory(testDocPath);

      expect(content).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Document ${testDocPath} has no history`,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("deleteDocument", () => {
    it("should delete a document from the tracker", () => {
      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);
      tracker.deleteDocument(testDocPath);

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const ast = tracker.getMostRecentAst(testDocPath);
      const content = tracker.getMostRecentDocumentHistory(testDocPath);

      expect(ast).toBeNull();
      expect(content).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Document ${testDocPath} not found in AST tracker`,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("clearMap", () => {
    it("should clear all documents from the tracker", () => {
      const anotherDocPath = "/test/another-document.ts";

      tracker.addDocument(testDocPath, testContent1, mockAst1 as any);
      tracker.addDocument(anotherDocPath, testContent1, mockAst1 as any);

      tracker.clearMap();

      // Spy on console.error
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(tracker.getMostRecentAst(testDocPath)).toBeNull();
      expect(tracker.getMostRecentAst(anotherDocPath)).toBeNull();
      expect(tracker.getMostRecentDocumentHistory(testDocPath)).toBeNull();
      expect(tracker.getMostRecentDocumentHistory(anotherDocPath)).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });
});
