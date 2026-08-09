#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAKE_BIN="$ROOT/install/tests/fake-bin"
SCRIPT="$ROOT/install/package_after_remove.sh"

# The upgrade hooks must only reload systemd metadata.  In particular, they
# must not stop or disable the active service or remove the resident topology.
PATH="$FAKE_BIN:$PATH" "$SCRIPT" upgrade >/dev/null
PATH="$FAKE_BIN:$PATH" "$SCRIPT" 1 >/dev/null

# A normal removal is allowed to stop/disable the service and clean both the
# current daens namespace and the historical dae namespace.
PATH="$FAKE_BIN:$PATH" "$SCRIPT" remove >/dev/null
echo "package removal lifecycle fixture passed"
