#!/usr/bin/env bash

pnpm install --frozen-lockfile
pnpm --filter=@gourmanddev/gui build
pnpm --filter=@gourmanddev/gobi-vscode-extension run prepackage
pnpm --filter=@gourmanddev/gobi-vscode-extension run vsix