import "@testing-library/jest-dom";

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.resetAllMocks();
});

// Suppress uncaught ProseMirror errors in test environment
window.addEventListener("error", (event) => {
  if (
    event.error?.message?.includes("getClientRects") ||
    event.error?.message?.includes("prosemirror")
  ) {
    event.preventDefault();
    return false;
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.message?.includes("getClientRects") ||
    event.reason?.message?.includes("prosemirror")
  ) {
    event.preventDefault();
    return false;
  }
});

// https://github.com/vitest-dev/vitest/issues/821
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock getBoundingClientRect and getClientRects for ProseMirror
Object.defineProperty(Element.prototype, "getClientRects", {
  value: vi.fn(() => ({
    length: 1,
    0: { top: 0, bottom: 20, left: 0, right: 100, width: 100, height: 20 },
    item: () => ({
      top: 0,
      bottom: 20,
      left: 0,
      right: 100,
      width: 100,
      height: 20,
    }),
  })),
});

Object.defineProperty(Element.prototype, "getBoundingClientRect", {
  value: vi.fn(() => ({
    top: 0,
    bottom: 20,
    left: 0,
    right: 100,
    width: 100,
    height: 20,
  })),
});

// Provide a constructible ResizeObserver for tests (some components call `new ResizeObserver(...)`)
class TestResizeObserver {
  private cb: ResizeObserverCallback | null = null;
  constructor(cb?: ResizeObserverCallback) {
    this.cb = cb || null;
  }
  observe(_target?: Element) {
    // no-op for tests
  }
  unobserve(_target?: Element) {
    // no-op for tests
  }
  disconnect() {
    // no-op for tests
  }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: TestResizeObserver,
});
