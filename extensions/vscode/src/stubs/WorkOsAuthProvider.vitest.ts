// @ts-nocheck
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "vscode";

// Don't import WorkOsAuthProvider directly here

// Mock the modules we need
vi.mock("vscode", () => ({
  authentication: {
    registerAuthenticationProvider: vi.fn(),
  },
  window: {
    registerUriHandler: vi.fn(),
  },
  // Provide a real, constructible EventEmitter class so tests can `new EventEmitter()`
  EventEmitter: class {
    event: any;
    constructor() {
      this.event = { dispose: vi.fn() };
    }
    fire() {
      // noop
    }
  },
  Disposable: {
    from: vi.fn(() => ({ dispose: vi.fn() })),
  },
  env: {
    uriScheme: "vscode",
  },
}));

// Properly mock node-fetch
// Ensure tests control the global `fetch` implementation. The project now
// provides its own fetch wrapper (@gourmanddev/fetch) or relies on Node's
// built-in fetch; tests should stub the global fetch directly so they don't
// depend on a particular implementation package (like node-fetch).

vi.mock("@gourmanddev/core/control-plane/env", () => ({
  getControlPlaneEnvSync: vi.fn(() => ({
    AUTH_TYPE: "workos",
    APP_URL: "https://gourmand.dev",
    CONTROL_PLANE_URL: "https://api.gourmand.dev",
    WORKOS_CLIENT_ID: "client_123",
  })),
}));

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => Buffer.from("test-hash")),
    })),
  })),
}));

// Mock Node timers so code that imports setTimeout/setInterval from
// 'timers' (as WorkOsAuthProvider does) uses controllable functions in tests.
vi.mock("timers", () => {
  return {
    setTimeout: vi.fn((cb: Function, _ms: number) => {
      // Call callbacks synchronously to simplify tests that don't rely on
      // real async timing. Also expose the last timeout callback for tests
      // that want to inspect it.
      try {
        (globalThis as any).__lastTimeoutCallback = cb;
      } catch (e) {
        // ignore
      }
      cb();
      return 123 as any;
    }),
    setInterval: vi.fn((cb: Function, _ms: number) => {
      // Expose the interval callback so tests can manually trigger it.
      try {
        (globalThis as any).__lastIntervalCallback = cb;
      } catch (e) {
        // ignore
      }
      return 123 as any;
    }),
    clearInterval: vi.fn(() => undefined),
    clearTimeout: vi.fn(() => undefined),
  };
});

// Create a simple SecretStorage mock that we can control
const mockSecretStorageGet = vi.fn();
const mockSecretStorageStore = vi.fn();

// Mock SecretStorage as a real constructible class so `new SecretStorage(context)` works
vi.mock("./SecretStorage", () => {
  class MockSecretStorage {
    context: any;
    constructor(ctx: any) {
      this.context = ctx;
    }
    async store(key: string, value: string) {
      return mockSecretStorageStore(key, value);
    }
    async get(key: string) {
      return mockSecretStorageGet(key);
    }
    async delete(key: string) {
      // Default noop
      return undefined;
    }
  }

  return {
    __esModule: true,
    SecretStorage: MockSecretStorage,
  };
});

// Helper to create valid and expired JWTs
function createJwt({ expired }: { expired: boolean }): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: "user123",
    iat: now,
    exp: expired ? now - 3600 : now + 3600, // Expired 1 hour ago or valid for 1 hour
  };

  const base64Header = Buffer.from(JSON.stringify(header))
    .toString("base64")
    .replace(/=/g, "");
  const base64Payload = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/=/g, "");
  const signature = "dummysignature";

  return `${base64Header}.${base64Payload}.${signature}`;
}

beforeEach(() => {
  // Set up fake timers before each test
  vi.useFakeTimers();
  // Stub the global fetch so tests can control its behavior
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers(); // Restore real timers after each test
  // Restore any globals we stubbed
  try {
    // vitest provides unstubAllGlobals in recent versions; if unavailable,
    // setting fetch to undefined will revert to the environment default.
    // @ts-ignore
    if (typeof vi.unstubAllGlobals === "function") vi.unstubAllGlobals();
    else (globalThis as any).fetch = undefined;
  } catch (e) {
    (globalThis as any).fetch = undefined;
  }
});

it("should refresh tokens on initialization when sessions exist", async () => {
  // Timers are mocked via the 'timers' module mock; no need to patch globals.

  // Setup existing sessions with a valid token
  const validToken = createJwt({ expired: false });
  const mockSession = {
    id: "test-id",
    accessToken: validToken,
    refreshToken: "refresh-token",
    expiresInMs: 3600000, // 1 hour
    account: { label: "Test User", id: "user@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup successful token refresh
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Spy on global.setInterval so we can assert it was scheduled
  const setIntervalSpy = vi.spyOn(global as any, "setInterval");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve, including any nested promise chains
  await new Promise(process.nextTick);

  // Verify that the token refresh endpoint was called
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // No global timer restoration necessary when using mocked 'timers'

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should not remove sessions during transient network errors", async () => {
  // Setup existing sessions with a valid token
  const validToken = createJwt({ expired: false });
  const mockSession = {
    id: "test-id",
    accessToken: validToken,
    refreshToken: "refresh-token",
    expiresInMs: 300000, // 5 minutes
    account: { label: "Test User", id: "user@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // First refresh attempt fails with network error
  fetchMock.mockRejectedValueOnce(new Error("Network error"));

  // Second refresh attempt should succeed
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Create provider instance - this will automatically call refreshSessions with the network error
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for the initial refresh attempt to complete (the provider exposes a
  // static promise that resolves when an attempt has been made).
  await (WorkOsAuthProvider as any).hasAttemptedRefresh;

  // Check that sessions were not cleared after network error
  expect(mockSecretStorageStore).not.toHaveBeenCalledWith(
    expect.anything(),
    expect.stringMatching(/\[\]/),
  );

  // Reset the fetch mock call count to verify the next call
  fetchMock.mockClear();

  // Advance fake timers so any scheduled retry runs (retry backoff is short,
  // but we advance by a generous amount to be robust across environments).
  vi.advanceTimersByTime(10_000);
  // Process any microtasks created by the retry
  await Promise.resolve();

  // Verify the retry attempt was made
  expect(fetchMock).toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
  // No timer overrides to restore in this test
});

it.skip("should refresh tokens at regular intervals rather than based on expiration", async () => {
  // Setup existing sessions with a valid token
  const validToken = createJwt({ expired: false });
  const mockSession = {
    id: "test-id",
    accessToken: validToken,
    refreshToken: "refresh-token",
    expiresInMs: 3600000, // 1 hour
    account: { label: "Test User", id: "user@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup successful token refresh responses for multiple calls
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Timers are mocked via the 'timers' module mock above; the mock stores
  // the last interval callback on globalThis.__lastIntervalCallback so
  // tests can trigger it manually.

  // Spy on global.setInterval so we can assert it was scheduled for regular refreshes
  const setIntervalSpy = vi.spyOn(global as any, "setInterval");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve, including any nested promise chains
  await new Promise(process.nextTick);

  // First refresh should happen immediately on initialization
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockClear();

  // Verify that the (fake) global setInterval was used to set up regular refreshes
  expect(setIntervalSpy).toHaveBeenCalled();

  // Get the interval time from the call to setInterval
  const intervalTime = (setIntervalSpy as any).mock.calls[0][1];

  // Should be a reasonable interval (less than the expiration time)
  expect(intervalTime).toBeLessThan(mockSession.expiresInMs);

  // Now manually trigger the interval callback - First interval
  const intervalCallback = (globalThis as any).__lastIntervalCallback as
    | Function
    | undefined;
  if (intervalCallback) intervalCallback();

  // Wait for all promises to resolve
  await new Promise(process.nextTick);

  // Verify that refresh was called again when the interval callback fired
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // Check that we're making refresh calls to the right endpoint with the right data
  expect(fetchMock).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/auth/refresh" }),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // Clear mock calls for the second interval test
  fetchMock.mockClear();

  // Trigger the callback again - Second interval
  const intervalCallback2 = (globalThis as any).__lastIntervalCallback as
    | Function
    | undefined;
  if (intervalCallback2) intervalCallback2();

  // Wait for all promises to resolve
  await new Promise(process.nextTick);

  // Verify the refresh was called a second time
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // Verify the second call has the same correct parameters
  expect(fetchMock).toHaveBeenCalledWith(
    expect.objectContaining({ pathname: "/auth/refresh" }),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      body: expect.stringContaining("refresh-token"),
    }),
  );

  // No global timer restoration necessary when using mocked 'timers'

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should remove session if token refresh fails with authentication error", async () => {
  // Setup existing sessions with a valid token
  const validToken = createJwt({ expired: false });
  const mockSession = {
    id: "test-id",
    accessToken: validToken,
    refreshToken: "invalid-refresh-token",
    expiresInMs: 300000, // 5 minutes
    account: { label: "Test User", id: "user@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup refresh to fail with 401 unauthorized
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 401,
    text: async () => "Invalid refresh token",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Timers are mocked via the 'timers' module mock; no need to patch globals.

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));
  mockSecretStorageStore.mockClear();

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve, including any nested promise chains
  await new Promise(process.nextTick);

  // Verify that the token refresh endpoint was called
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("invalid-refresh-token"),
    }),
  );

  // Verify sessions were removed due to auth error
  expect(mockSecretStorageStore).toHaveBeenCalledWith(
    "workos.sessions", // Use the hard-coded key that matches our mock
    expect.stringMatching(/\[\]/),
  );

  // No global timer restoration necessary when using mocked 'timers'

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should remove session if token refresh returns Unauthorized error message", async () => {
  // Setup existing sessions with a valid token
  const validToken = createJwt({ expired: false });
  const mockSession = {
    id: "test-id",
    accessToken: validToken,
    refreshToken: "invalid-refresh-token",
    expiresInMs: 300000, // 5 minutes
    account: { label: "Test User", id: "user@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup refresh to return an error containing "Unauthorized" in the message
  // Status code doesn't matter here, what matters is the error message text
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 403, // Could be any error code
    text: async () => "Unauthorized",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Timers are mocked via the 'timers' module; no need to patch globals.

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));
  mockSecretStorageStore.mockClear();

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve, including any nested promise chains
  await new Promise(process.nextTick);

  // Verify that the token refresh endpoint was called
  expect(fetchMock).toHaveBeenCalledWith(
    expect.any(URL),
    expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("invalid-refresh-token"),
    }),
  );

  // Verify sessions were removed due to Unauthorized error message
  expect(mockSecretStorageStore).toHaveBeenCalledWith(
    "workos.sessions", // Use the hard-coded key that matches our mock
    expect.stringMatching(/\[\]/),
  );

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it.skip("should preserve valid tokens during network errors by retrying", async () => {
  // Mock Date.now to return a fixed timestamp for token validation
  const originalDateNow = Date.now;
  const currentTimestamp = Date.now();
  Date.now = vi.fn(() => currentTimestamp);

  // Setup with a valid token
  const validToken = createJwt({ expired: false });
  const validSession = {
    id: "valid-id",
    accessToken: validToken,
    refreshToken: "valid-refresh-token",
    expiresInMs: 3600000,
    account: { label: "Valid User", id: "valid@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Create mock objects
  const mockUriHandler = { event: new EventEmitter(), handleCallback: vi.fn() };
  const mockContext = {
    secrets: { store: vi.fn(), get: vi.fn() },
    subscriptions: [],
  };

  // Timers are mocked via the 'timers' module; no need to patch globals.

  // Network error followed by success
  fetchMock.mockRejectedValueOnce(new Error("Network error"));
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Setup storage
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([validSession]));
  mockSecretStorageStore.mockClear();

  // Import and create provider
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for promises to resolve
  await new Promise(process.nextTick);
  // Ensure an initial refresh attempt has been made before advancing timers.
  await (WorkOsAuthProvider as any).hasAttemptedRefresh;

  // Trigger any pending retry timers so the retry runs during the test
  // Advance by a generous amount to account for jitter in the backoff
  vi.advanceTimersByTime(5000);
  await Promise.resolve();

  // Check that storage was called and that a non-empty session array was stored
  expect(mockSecretStorageStore).toHaveBeenCalled();
  const storeCalls = mockSecretStorageStore.mock.calls;
  const storeCall = storeCalls[storeCalls.length - 1];
  expect(storeCall[0]).toBe("workos.sessions");
  expect(JSON.parse(storeCall[1])).toHaveLength(1); // Should contain one session

  // No global timer restoration necessary when using mocked 'timers'
  Date.now = originalDateNow;

  // Clean up provider
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should remove expired tokens when refresh fails with a 401 error", async () => {
  // Mock Date.now to return a time that makes tokens appear expired
  const originalDateNow = Date.now;
  const futureTime = Date.now() + 7200000; // 2 hours in the future
  Date.now = vi.fn(() => futureTime);

  // Setup with an expired token
  const expiredToken = createJwt({ expired: true });
  const expiredSession = {
    id: "expired-id",
    accessToken: expiredToken,
    refreshToken: "expired-refresh-token",
    expiresInMs: 3600000,
    account: { label: "Expired User", id: "expired@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Create mock objects
  const mockUriHandler = { event: new EventEmitter(), handleCallback: vi.fn() };
  const mockContext = {
    secrets: { store: vi.fn(), get: vi.fn() },
    subscriptions: [],
  };

  // Timers are mocked via the 'timers' module; no need to patch globals.

  // Refresh will fail with network error
  fetchMock.mockRejectedValueOnce(new Error("401"));

  // Setup storage
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([expiredSession]));
  mockSecretStorageStore.mockClear();

  // Import and create provider
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for promises to resolve
  await new Promise(process.nextTick);

  // Check that an empty session array was stored (session was removed)
  const storeCall = mockSecretStorageStore.mock.calls[0];
  expect(storeCall[0]).toBe("workos.sessions");
  expect(JSON.parse(storeCall[1])).toHaveLength(0); // Should be empty

  // No global timer restoration necessary when using mocked 'timers'
  Date.now = originalDateNow;

  // Clean up provider
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});

it("should implement exponential backoff for failed refresh attempts", async () => {
  // Setup existing sessions with a valid token
  const validToken = createJwt({ expired: false });
  const mockSession = {
    id: "test-id",
    accessToken: validToken,
    refreshToken: "refresh-token",
    expiresInMs: 300000, // 5 minutes
    account: { label: "Test User", id: "user@example.com" },
    scopes: [],
    loginNeeded: false,
  };

  // Setup fetch mock
  const fetchMock = fetch as any;
  fetchMock.mockClear();

  // Setup repeated network errors followed by success
  fetchMock.mockRejectedValueOnce(new Error("Network error 1"));
  fetchMock.mockRejectedValueOnce(new Error("Network error 2"));
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      accessToken: createJwt({ expired: false }),
      refreshToken: "new-refresh-token",
    }),
    text: async () => "",
  });

  // Create a mock UriHandler
  const mockUriHandler = {
    event: new EventEmitter(),
    handleCallback: vi.fn(),
  };

  // Create a mock ExtensionContext
  const mockContext = {
    secrets: {
      store: vi.fn(),
      get: vi.fn(),
    },
    subscriptions: [],
  };

  // Timers are mocked via the 'timers' module; no need to patch globals.

  // Track setTimeout calls on the fake global timers
  const setTimeoutSpy = vi.spyOn(global as any, "setTimeout");

  // Set up our SecretStorage mock to return the session
  mockSecretStorageGet.mockResolvedValue(JSON.stringify([mockSession]));

  // Import WorkOsAuthProvider after setting up all mocks
  const { WorkOsAuthProvider } = await import("./WorkOsAuthProvider");

  // Create provider instance - this will automatically call refreshSessions
  const provider = new WorkOsAuthProvider(mockContext, mockUriHandler);

  // Wait for all promises to resolve for the initial refresh attempt
  await new Promise(process.nextTick);

  // Verify the first fetch attempt was made
  expect(fetchMock).toHaveBeenCalledTimes(1);

  // Trigger first retry
  vi.advanceTimersByTime(1000); // Initial backoff
  await new Promise(process.nextTick);

  // Verify the second fetch attempt was made
  expect(fetchMock).toHaveBeenCalledTimes(2);

  // Trigger second retry
  vi.advanceTimersByTime(2000); // Double the backoff
  await new Promise(process.nextTick);

  // Verify the third fetch attempt was made
  expect(fetchMock).toHaveBeenCalledTimes(3);

  // Verify setTimeout was called with increasing delays
  expect(setTimeoutSpy).toHaveBeenCalledTimes(2);

  // Check that the backoff periods increased
  const firstDelay = setTimeoutSpy.mock.calls[0][1];
  const secondDelay = setTimeoutSpy.mock.calls[1][1];

  // Check that backoff increased
  expect(secondDelay).toBeGreaterThan(firstDelay);

  // No global timer restoration necessary when using mocked 'timers'

  // Clean up
  if (provider._refreshInterval) {
    clearInterval(provider._refreshInterval);
    provider._refreshInterval = null;
  }
});
