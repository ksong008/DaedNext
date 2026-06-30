#!/bin/bash

case "${1:-}" in
    upgrade|failed-upgrade|abort-upgrade|1)
        systemctl daemon-reload
        exit 0
        ;;
esac

systemctl stop daed.service >/dev/null 2>&1 || true
ip link del dae0 >/dev/null 2>&1 || true
ip netns del dae >/dev/null 2>&1 || true
rm -rf /run/daed
systemctl daemon-reload
