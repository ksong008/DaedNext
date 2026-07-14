#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAKE_BIN="$ROOT/install/tests/fake-bin"
SCRIPT="$ROOT/install/package_after_install.sh"

PATH="$FAKE_BIN:$PATH" DAED_TEST_RESTART_EXIT=0 "$SCRIPT" >/dev/null

if PATH="$FAKE_BIN:$PATH" DAED_TEST_RESTART_EXIT=1 "$SCRIPT" >/dev/null 2>&1; then
    echo "package lifecycle fixture expected restart failure to propagate" >&2
    exit 1
fi

PATH="$FAKE_BIN:$PATH" DAED_TEST_IS_ACTIVE_EXIT=3 "$SCRIPT" >/dev/null
echo "package lifecycle fixture passed"
