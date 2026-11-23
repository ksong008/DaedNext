#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAKE_BIN="$ROOT/install/tests/fake-bin"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/systemd" "$WORK/state"
for hook in before after; do
    sed -e "s|/run/systemd/system|$WORK/systemd|g" \
        -e "s|/var/lib/daed|$WORK/state|g" \
        "$ROOT/install/package_${hook}_remove.sh" >"$WORK/$hook"
done
export PATH="$FAKE_BIN:$PATH"
export DAED_TEST_CALL_LOG="$WORK/calls"

pending="$WORK/state/package-restart-required"
touch "$pending"
for action in upgrade failed-upgrade abort-upgrade 1 2; do
    : >"$DAED_TEST_CALL_LOG"
    sh "$WORK/before" "$action"
    sh "$WORK/after" "$action"
    test "$(tail -n 1 "$DAED_TEST_CALL_LOG")" = "systemctl daemon-reload"
    test "$(wc -l <"$DAED_TEST_CALL_LOG")" -eq 2
    test -f "$pending"
done

: >"$DAED_TEST_CALL_LOG"
if DAED_TEST_STOP_EXIT=1 sh "$WORK/before" remove >/dev/null 2>&1; then
    echo "prerm accepted removal after stop failed" >&2
    exit 1
fi
test "$(tail -n 1 "$DAED_TEST_CALL_LOG")" = "systemctl stop daed.service"
test -f "$pending"

: >"$DAED_TEST_CALL_LOG"
sh "$WORK/before" 0
sh "$WORK/after" 0
test ! -e "$pending"
test "$(cat "$DAED_TEST_CALL_LOG")" = "systemctl show --property=Version --value
systemctl stop daed.service
systemctl --root=/ disable daed.service
systemctl show --property=Version --value
systemctl daemon-reload"
echo "package removal lifecycle fixture passed"
