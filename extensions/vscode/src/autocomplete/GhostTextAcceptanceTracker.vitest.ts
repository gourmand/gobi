import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";
// We'll import the module under test dynamically inside beforeEach
let GhostTextAcceptanceTracker: any;

// Mock the vscode module with constructible classes so tests can use `new vscode.Position(...)`
vi.mock("vscode", () => {
  class Position {
    constructor(
      public line: number,
      public character: number,
    ) {}
    isEqual(other: any) {
      return (
        other && other.line === this.line && other.character === this.character
      );
    }
  }

  class Range {
    constructor(
      public start: any,
      public end: any,
    ) {}
  }

  return {
    Position,
    Range,
  };
});

// Mock SelectionChangeManager to avoid importing large/async real implementation during tests.
vi.mock("../activation/SelectionChangeManager", () => {
  return {
    HandlerPriority: {
      CRITICAL: 5,
      HIGH: 4,
      NORMAL: 3,
      LOW: 2,
      FALLBACK: 1,
    },
    SelectionChangeManager: {
      getInstance: () => ({
        registerListener: () => {
          return () => {};
        },
      }),
    },
  };
});

// Mock svg-builder and its content entry so ESM directory imports don't fail in tests
vi.mock("svg-builder", () => {
  const mockSvgBuilder = {
    width: vi.fn().mockReturnThis(),
    height: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    render: vi.fn().mockReturnValue("<svg/>"),
  };
  return { default: mockSvgBuilder };
});

vi.mock("svg-builder/dist/esm/content", () => ({
  default: {
    // Provide minimal content exports expected by svg-builder internals
    text: (s: string) => s,
  },
}));

describe("GhostTextAcceptanceTracker", () => {
  let tracker: any;
  let mockDocument: vscode.TextDocument;

  beforeEach(() => {
    // Create mock document first so it's available to nested beforeEach blocks
    mockDocument = {
      uri: {
        toString: () => "file:///test.ts",
      },
      version: 1,
      getText: vi.fn(),
    } as any;

    // Clear any existing instance and import the module under test after mocks
    // (dynamic import ensures our file-level mocks run before module evaluation)
    return import("./GhostTextAcceptanceTracker").then((mod) => {
      GhostTextAcceptanceTracker = mod.GhostTextAcceptanceTracker;
      GhostTextAcceptanceTracker.clearInstance();
      tracker = GhostTextAcceptanceTracker.getInstance();
    });
  });

  describe("getInstance", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = GhostTextAcceptanceTracker.getInstance();
      const instance2 = GhostTextAcceptanceTracker.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should create a new instance after clearInstance is called", () => {
      const instance1 = GhostTextAcceptanceTracker.getInstance();
      GhostTextAcceptanceTracker.clearInstance();
      const instance2 = GhostTextAcceptanceTracker.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("setExpectedGhostTextAcceptance", () => {
    it("should set expected acceptance for single line text", () => {
      const startPosition = new vscode.Position(5, 10);
      const text = "console.log('hello')";

      tracker.setExpectedGhostTextAcceptance(mockDocument, text, startPosition);

      // Verify internal state by testing checkGhostTextWasAccepted.
      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockReturnValue(text),
      } as any;
      const endPosition = new vscode.Position(5, 30); // 10 in startPosition + 20 characters in text

      expect(tracker.checkGhostTextWasAccepted(newDocument, endPosition)).toBe(
        true,
      );
    });

    it("should set expected acceptance for multi-line text", () => {
      const startPosition = new vscode.Position(5, 10);
      const text = "function test() {\n  return 'hello';\n}";

      tracker.setExpectedGhostTextAcceptance(mockDocument, text, startPosition);

      // For multi-line, end position should be at line 7 (5 + 3 lines - 1), character 1 (length of last line).
      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockReturnValue(text),
      } as any;
      const endPosition = new vscode.Position(7, 1);

      expect(tracker.checkGhostTextWasAccepted(newDocument, endPosition)).toBe(
        true,
      );
    });
  });

  describe("checkGhostTextWasAccepted", () => {
    beforeEach(() => {
      const startPosition = new vscode.Position(5, 10);
      const text = "console.log('test')";
      tracker.setExpectedGhostTextAcceptance(mockDocument, text, startPosition);
    });

    it("should return false when no expected acceptance is set", () => {
      GhostTextAcceptanceTracker.clearInstance();
      const newTracker = GhostTextAcceptanceTracker.getInstance();

      const newDocument = { ...mockDocument, version: 2 } as any;
      const position = new vscode.Position(5, 29);

      expect(newTracker.checkGhostTextWasAccepted(newDocument, position)).toBe(
        false,
      );
    });

    it("should return false when document URI doesn't match", () => {
      const differentDocument = {
        ...mockDocument,
        uri: { toString: () => "file:///different.ts" },
        version: 2,
      } as any;
      const position = new vscode.Position(5, 29);

      expect(
        tracker.checkGhostTextWasAccepted(differentDocument, position),
      ).toBe(false);
    });

    it("should return false when document version is not newer", () => {
      const sameVersionDocument = {
        ...mockDocument,
        version: 1, // same version
      } as any;
      const position = new vscode.Position(5, 29);

      expect(
        tracker.checkGhostTextWasAccepted(sameVersionDocument, position),
      ).toBe(false);

      const olderVersionDocument = {
        ...mockDocument,
        version: 0, // older version
      } as any;

      expect(
        tracker.checkGhostTextWasAccepted(olderVersionDocument, position),
      ).toBe(false);
    });

    it("should return false when cursor position doesn't match expected end position", () => {
      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockReturnValue("console.log('test')"),
      } as any;
      const wrongPosition = new vscode.Position(5, 20); // wrong position

      expect(
        tracker.checkGhostTextWasAccepted(newDocument, wrongPosition),
      ).toBe(false);
    });

    it("should return false when text content doesn't match", () => {
      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockReturnValue("different text"), // wrong text
      } as any;
      const correctPosition = new vscode.Position(5, 29);

      expect(
        tracker.checkGhostTextWasAccepted(newDocument, correctPosition),
      ).toBe(false);
    });

    it("should return true when all conditions match and clear expectation", () => {
      const expectedText = "console.log('test')";
      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockReturnValue(expectedText),
      } as any;
      const correctPosition = new vscode.Position(5, 29); // 10 + 19 characters

      expect(
        tracker.checkGhostTextWasAccepted(newDocument, correctPosition),
      ).toBe(true);

      // Check for clearing logic.
      expect(
        tracker.checkGhostTextWasAccepted(newDocument, correctPosition),
      ).toBe(false);
    });

    it("should handle getText throwing an error gracefully", () => {
      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockImplementation(() => {
          throw new Error("Range invalid");
        }),
      } as any;
      const correctPosition = new vscode.Position(5, 29);

      expect(
        tracker.checkGhostTextWasAccepted(newDocument, correctPosition),
      ).toBe(false);
    });

    it("should work with multi-line ghost text acceptance", () => {
      const startPosition = new vscode.Position(0, 0);
      const multiLineText = "if (condition) {\n  doSomething();\n}";
      tracker.setExpectedGhostTextAcceptance(
        mockDocument,
        multiLineText,
        startPosition,
      );

      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockReturnValue(multiLineText),
      } as any;
      const endPosition = new vscode.Position(2, 1); // line 2, character 1 (length of "}")

      expect(tracker.checkGhostTextWasAccepted(newDocument, endPosition)).toBe(
        true,
      );
    });

    it("should handle empty text", () => {
      const startPosition = new vscode.Position(10, 5);
      const emptyText = "";
      tracker.setExpectedGhostTextAcceptance(
        mockDocument,
        emptyText,
        startPosition,
      );

      const newDocument = {
        ...mockDocument,
        version: 2,
        getText: vi.fn().mockReturnValue(""),
      } as any;
      const samePosition = new vscode.Position(10, 5); // should be same as start for empty text

      expect(tracker.checkGhostTextWasAccepted(newDocument, samePosition)).toBe(
        true,
      );
    });
  });
});
