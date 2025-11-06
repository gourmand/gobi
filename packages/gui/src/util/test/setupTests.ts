import "@testing-library/jest-dom";

afterEach(async () => {
  // Clear mocks and flush microtasks/macrotasks to help avoid "not wrapped in act(...)" warnings
  // by ensuring effects and queued promise resolutions run before the test teardown.
  vi.clearAllMocks();
  // Allow any pending microtasks to run
  await Promise.resolve();
  // Allow any queued macrotasks scheduled with setTimeout(..., 0) to run
  await new Promise((resolve) => setTimeout(resolve, 0));
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

// Temporarily filter out noisy React act(...) warnings in test output.
// These warnings indicate updates happening outside of act() and should
// ideally be fixed per-test or component. For now, suppress them to keep
// CI/test logs readable while we gradually eliminate root causes.
const __origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  try {
    const first = args[0];
    if (typeof first === "string") {
      // Filter the common act warning message fragments
      if (
        first.includes("not wrapped in act(") ||
        /An update to .* inside a test was not wrapped in act/.test(first)
      ) {
        return;
      }
    }
  } catch (e) {
    // fallthrough to original
  }
  __origConsoleError(...args);
};

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
