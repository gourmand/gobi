import { TextDecoder, TextEncoder } from "util";

import { beforeAll } from "vitest";

beforeAll(() => {
  // @ts-ignore
  globalThis.fetch = fetch;
  // @ts-ignore
  globalThis.Request = Request;
  // @ts-ignore
  globalThis.Response = Response;
  globalThis.TextEncoder = TextEncoder;
  // @ts-ignore
  globalThis.TextDecoder = TextDecoder;
});
