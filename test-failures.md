# Test Failure Log

## packages/config-yaml

- command: `pnpm --filter @gourmanddev/config-yaml test`
- result: ✅ All tests passed (13 suites, 214 tests)
- notes: Console warnings emitted while parsing intentionally malformed markdown fixtures; no test failures.

## packages/config-types

- command: `pnpm --filter @gourmanddev/config-types test`
- result: ℹ️ No tests defined (script omits test runner)
- notes: Package reports "No tests to run".

## packages/core

- command: `pnpm --filter @gourmanddev/core test`
- result: ❌ Failures (15 suites, 63 tests)
- failing areas:
  - `llm/llms/Bedrock.test.ts`: constructor now requires guardrail env ids; tests lack stubbed values.
  - `edit/lazy/deterministic.test.ts`: lazy edit diff expectations receiving empty output.
  - Multiple `indexing/*` and `util/*` suites: Jest cannot load ESM `parse5` via jsdom in CommonJS runtime.
  - `indexing/chunk/code.test.ts`: tree-sitter parser lookup returns undefined for fixture files.
