#!/bin/sh
set -eu

case "${1:-}" in
    remove|purge|0|[0-9]*-*)
        rm -f /var/lib/daed/package-restart-required
        if command -v systemctl >/dev/null 2>&1; then
            systemctl --root=/ disable daed.service
        fi
        ;;
esac

if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1 &&
    systemctl show --property=Version --value >/dev/null 2>&1; then
    systemctl daemon-reload
fi
