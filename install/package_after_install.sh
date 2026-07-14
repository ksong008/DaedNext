#!/bin/bash
set -euo pipefail

systemctl daemon-reload

if systemctl is-active --quiet daed.service; then
    if command -v flock >/dev/null 2>&1; then
        mkdir -p /run/lock
        exec 9>/run/lock/daed-package-restart.lock
        if ! flock -w 120 9; then
            echo "Failed to acquire daed package restart lock within 120 seconds." >&2
            exit 1
        fi
    fi
    if ! systemctl restart daed.service; then
        systemctl status --no-pager daed.service >&2 || true
        echo "Failed to restart daed.service after package installation; package operation is failing." >&2
        exit 1
    fi
    echo "Restarted daed.service and verified readiness after package installation."
fi
