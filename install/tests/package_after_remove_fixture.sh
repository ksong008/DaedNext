#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAKE_BIN="$ROOT/install/tests/fake-bin"
SCRIPT="$ROOT/install/package_after_remove.sh"
CALL_LOG="$(mktemp)"
trap 'rm -f "$CALL_LOG"' EXIT

# The upgrade hooks must only reload systemd metadata.  In particular, they
# must not stop or disable the active service or remove the resident topology.
: >"$CALL_LOG"
PATH="$FAKE_BIN:$PATH" DAED_TEST_CALL_LOG="$CALL_LOG" "$SCRIPT" upgrade >/dev/null
test "$(cat "$CALL_LOG")" = "systemctl daemon-reload"

: >"$CALL_LOG"
PATH="$FAKE_BIN:$PATH" DAED_TEST_CALL_LOG="$CALL_LOG" "$SCRIPT" 1 >/dev/null
test "$(cat "$CALL_LOG")" = "systemctl daemon-reload"

# A normal removal is allowed to stop/disable the service and clean both the
# current daens namespace and the historical dae namespace.
: >"$CALL_LOG"
PATH="$FAKE_BIN:$PATH" DAED_TEST_CALL_LOG="$CALL_LOG" "$SCRIPT" remove >/dev/null
grep -Fx 'systemctl stop daed.service' "$CALL_LOG" >/dev/null
grep -Fx 'systemctl disable daed.service' "$CALL_LOG" >/dev/null
grep -Fx 'ip link del dae0' "$CALL_LOG" >/dev/null
grep -Fx 'ip netns del daens' "$CALL_LOG" >/dev/null
grep -Fx 'ip netns del dae' "$CALL_LOG" >/dev/null
grep -Fx 'systemctl daemon-reload' "$CALL_LOG" >/dev/null
echo "package removal lifecycle fixture passed"
