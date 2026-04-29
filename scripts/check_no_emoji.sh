#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATTERN='[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]'

cd "$ROOT"

if rg -nUP "$PATTERN" \
  --glob 'Makefile' \
  --glob '*.ts' \
  --glob '*.tsx' \
  --glob '*.js' \
  --glob '*.mjs' \
  --glob '*.cjs' \
  --glob '*.css' \
  --glob '*.go' \
  --glob '*.sh' \
  --glob '*.yml' \
  --glob '*.yaml' \
  --glob '*.json' \
  --glob '!**/.git/**' \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  .; then
  echo "emoji characters are not allowed in code/config files"
  exit 1
fi
