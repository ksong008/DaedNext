#!/bin/bash

case "${1:-}" in
    upgrade|failed-upgrade|abort-upgrade|1)
        systemctl daemon-reload
        exit 0
        ;;
esac

# A real removal must leave no enabled unit which points at the deleted
# /usr/bin/daed.  Upgrade/failed-upgrade/abort-upgrade return above so an
# active service is never disabled as part of a package replacement.
systemctl stop daed.service >/dev/null 2>&1 || true
systemctl disable daed.service >/dev/null 2>&1 || true

# The resident production topology uses dae0 plus the daens network
# namespace.  Keep the historical dae namespace cleanup for older installs.
ip link del dae0 >/dev/null 2>&1 || true
ip netns del daens >/dev/null 2>&1 || true
ip netns del dae >/dev/null 2>&1 || true

rm -rf /run/daed
systemctl daemon-reload
