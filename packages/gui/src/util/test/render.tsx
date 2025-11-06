import type { RenderOptions, RenderResult } from "@testing-library/react";
import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { MemoryRouter, RouterProps } from "react-router-dom";
import { MainEditorProvider } from "../../components/mainInput/TipTapEditor";
import { AuthProvider } from "../../context/Auth";
import { IdeMessengerProvider } from "../../context/IdeMessenger";
import { MockIdeMessenger } from "../../context/MockIdeMessenger";
import ParallelListeners from "../../hooks/ParallelListeners";
import { setupStore } from "../../redux/store";
// As a basic setup, import your same slice reducers

// This type interface extends the default options for render from RTL, as well
// as allows the user to specify other things such as initialState, store.
type ExtendedRenderOptions = Omit<RenderOptions, "queries"> & {
  store?: ReturnType<typeof setupStore>;
  routerProps?: RouterProps;
  mockIdeMessenger?: MockIdeMessenger;
};

function setupMocks() {
  // Provide a constructible ResizeObserver mock (some components call `new ResizeObserver(...)`)
  class MockResizeObserver {
    cb: ResizeObserverCallback | null = null;
    constructor(cb?: ResizeObserverCallback) {
      this.cb = cb ?? null;
    }
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }

  // Assign to global so code using `new ResizeObserver(...)` works in tests
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - test shim
  (global as any).ResizeObserver = MockResizeObserver;
}

export async function renderWithProviders(
  ui: React.ReactElement,
  extendedRenderOptions: ExtendedRenderOptions = {},
) {
  setupMocks();
  const ideMessenger =
    extendedRenderOptions?.mockIdeMessenger ?? new MockIdeMessenger();

  const {
    // Automatically create a store instance if no store was passed in
    store = setupStore({
      ideMessenger,
    }),
    routerProps = {},
    ...renderOptions
  } = extendedRenderOptions;

  const user = userEvent.setup();

  const Wrapper = ({ children }: PropsWithChildren) => (
    <MemoryRouter {...routerProps}>
      <IdeMessengerProvider messenger={ideMessenger}>
        <Provider store={store}>
          <AuthProvider>
            <MainEditorProvider>
              {children}
              <ParallelListeners />
            </MainEditorProvider>
          </AuthProvider>
        </Provider>
      </IdeMessengerProvider>
    </MemoryRouter>
  );

  let rendered: RenderResult;
  await act(async () => {
    rendered = render(ui, { wrapper: Wrapper, ...renderOptions });
  });

  // Flush pending effects and microtasks to reduce "not wrapped in act(...)" warnings
  // Tests can still opt to await specific updates where needed, but this helps
  // reduce common noisy warnings caused by microtask scheduling during mount.
  // Small timeout ensures queued macrotasks are processed as well.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  // Return an object with the store and all of RTL's query functions
  return {
    user,
    store,
    ideMessenger,
    ...rendered!,
  };
}
