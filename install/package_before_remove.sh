#!/bin/sh
set -eu

case "${1:-}" in
    remove|0|[0-9]*-*) ;;
    *) exit 0 ;;
esac

if [ -d /run/systemd/system ] && command -v systemctl >/dev/null 2>&1 &&
    systemctl show --property=Version --value >/dev/null 2>&1; then
    # The running daemon owns its network topology and cleans it on shutdown.
    if ! systemctl stop daed.service; then
        echo "Failed to stop daed.service before package removal." >&2
        exit 1
    fi
fi
