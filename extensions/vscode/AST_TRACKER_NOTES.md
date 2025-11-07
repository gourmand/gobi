File: extensions/vscode/src/activation/activate.ts

## Summary

This note documents that `extensions/vscode/src/activation/activate.ts` was observed as "not found in AST tracker" during a repository scan. This file does exist in the repository and is actively edited (see recent changes to YAML schema registration). The purpose of this note is to give quick troubleshooting steps and recommendations so the AST tracking/indexing system includes this file.

## Possible reasons the file is missing from the AST tracker

1. Path/glob exclusion
   - The tracker may be configured with exclude globs (e.g., `extensions/**/dist/**`, `**/node_modules/**`) that unintentionally match the file's path. Verify the tracker's include/exclude globs.

2. File extension handling
   - Some trackers only parse `.ts` files in certain folders or require explicit TypeScript parsing flags. Ensure the tracker accepts `.ts` and TypeScript syntax features used in the repository.

3. Indexing race / stale index
   - The file may have been added/renamed after the tracker's last run. Re-run the tracker or trigger a re-index.

4. Build-generated redirect
   - If the tracker is configured to index a different source root (for example `dist/` or prebuilt outputs), the source `src/` file might not be included unless the tracker is told to index sources.

5. Permissions / filesystem issues
   - Rare: the tracker process lacked permission to read the file or the file was briefly missing during scanning.

## What I changed recently (context)

- `extensions/vscode/src/activation/activate.ts` was edited to add a defensive guard for `yaml.schemas` registration so activation doesn't throw when the YAML extension isn't installed.
  - This change is in the `more_tests` branch at the time of writing.

## Quick checks to re-include the file in the AST tracker

1. Re-run the tracker/indexer and capture its logs to see why it skipped the file.
   - Example (tracker CLI, replace with your tool):
     ```bash
     tracker-cli reindex --verbose
     # or
     ./scripts/ast-tracker --reindex --debug
     ```

2. Inspect tracker config (common locations):
   - `.astconfig`, `.astignore`, `package.json` scripts, CI config, or a top-level `scripts/` helper used to invoke the tracker.
   - Ensure there isn't an exclude pattern like `extensions/**/src/activation/**` or `**/activation/**`.

3. Confirm the path is included by the tracker's include globs. If it isn't, add `extensions/vscode/src/**` to the include patterns.

4. If the tracker only indexes built JS, ensure source mapping or build step places this file into the expected indexed location (but best is to index sources directly).

5. If permission errors are suspected, run:
   ```bash
   ls -l extensions/vscode/src/activation/activate.ts
   cat extensions/vscode/src/activation/activate.ts | head -n 40
   ```

## Recommendations

- Prefer indexing TypeScript source (`extensions/vscode/src/**`) instead of built outputs. That keeps the AST model accurate and editable.
- Add a CI step that validates the tracker index includes a small set of sentinel files (for example, this activate.ts) and fails the build if they are missing.
- If your tracker supports a manual include list, add `extensions/vscode/src/activation/activate.ts` as a sentinel entry.

If you'd like, I can:

- Inspect tracker configuration files in this repo to locate exclude globs and propose a minimal change.
- Re-run the tracker (if it's a CLI script in the repo) here and show the logs that explain why the file was skipped.

Timestamp: 2025-11-06T20:45:00Z
Branch: more_tests
Created-by: automated documentation step
