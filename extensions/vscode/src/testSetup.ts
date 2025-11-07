import { vi } from "vitest";

// Global svg-builder mock to avoid ESM directory import issues in tests
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
    text: (s: string) => s,
  },
}));
