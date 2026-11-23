#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAKE_BIN="$ROOT/install/tests/fake-bin"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
SCRIPT="$WORK/postinst"
sed -e "s|/run/systemd/system|$WORK/systemd|g" \
    -e "s|/run/lock|$WORK/lock|g" \
    -e "s|/var/lib/daed|$WORK/state|g" \
    -e "s|/usr/sbin/policy-rc.d|$WORK/policy-rc.d|g" \
    "$ROOT/install/package_after_install.sh" >"$SCRIPT"
export PATH="$FAKE_BIN:$PATH"
export DAED_TEST_CALL_LOG="$WORK/calls"

# The RPM scriptlet uses /bin/sh. Offline installation must leave services alone.
sh "$SCRIPT" 1
test ! -e "$DAED_TEST_CALL_LOG"
mkdir "$WORK/systemd"
DAED_TEST_BUS_EXIT=1 sh "$SCRIPT" configure
test "$(cat "$DAED_TEST_CALL_LOG")" = "systemctl show --property=Version --value"
: >"$DAED_TEST_CALL_LOG"
DAED_TEST_ACTIVE_STATE=inactive sh "$SCRIPT" configure
if grep -q '^systemctl restart' "$DAED_TEST_CALL_LOG"; then
    echo "fresh installation unexpectedly started daed" >&2
    exit 1
fi

if DAED_TEST_RESTART_EXIT=1 sh "$SCRIPT" configure >/dev/null 2>&1; then
    echo "package lifecycle fixture expected restart failure to propagate" >&2
    exit 1
fi
test -f "$WORK/state/package-restart-required"

# An inactive service with restart pending must be retried.
: >"$DAED_TEST_CALL_LOG"
DAED_TEST_ACTIVE_STATE=inactive sh "$SCRIPT" configure >/dev/null
grep -Fx 'systemctl restart daed.service' "$DAED_TEST_CALL_LOG" >/dev/null
test ! -e "$WORK/state/package-restart-required"

printf '#!/bin/sh\nexit 101\n' >"$WORK/policy-rc.d"
chmod +x "$WORK/policy-rc.d"
: >"$DAED_TEST_CALL_LOG"
sh "$SCRIPT" configure >/dev/null
test -f "$WORK/state/package-restart-required"
if grep -q '^systemctl restart' "$DAED_TEST_CALL_LOG"; then
    echo "postinst restarted daed despite policy-rc.d" >&2
    exit 1
fi

echo "package lifecycle fixture passed"
