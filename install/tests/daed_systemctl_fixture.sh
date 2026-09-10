#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/install/shell/daed-systemctl.bash"
export PATH="$ROOT/install/tests/async-fake-bin:$PATH"

expect_interactive() {
    local expected="$1" actual
    shift
    actual="$(bash --noprofile --norc -ic 'source "$1"; shift; systemctl "$@"' bash "$SCRIPT" "$@" 2>/dev/null)"
    if [[ "$actual" != "$expected" ]]; then
        printf 'expected: %s\nactual: %s\n' "$expected" "$actual" >&2
        exit 1
    fi
}

for unit in daed daed.service; do
    for operation in start restart; do
        expect_interactive "--no-block $operation $unit" "$operation" "$unit"
    done
done
expect_interactive 'status daed' status daed
expect_interactive 'stop daed' stop daed
expect_interactive 'restart ssh' restart ssh
expect_interactive 'restart daed ssh' restart daed ssh
expect_interactive '--wait restart daed' --wait restart daed
expect_interactive '--no-block restart daed' --no-block restart daed
expect_interactive 'restart daed --no-block' restart daed --no-block
expect_interactive ''

actual="$(bash --noprofile --norc -c 'source "$1"; systemctl restart daed' bash "$SCRIPT")"
[[ "$actual" == 'restart daed' ]]

status=0
DAED_TEST_SYSTEMCTL_EXIT=7 bash --noprofile --norc -ic \
    'source "$1"; systemctl restart daed' bash "$SCRIPT" >/dev/null 2>&1 || status=$?
[[ "$status" == 7 ]]
echo 'daed asynchronous systemctl fixture passed'
