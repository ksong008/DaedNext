#!/bin/sh
set -eu

case "${1:-}" in
    abort-*) exit 0 ;;
esac

if [ ! -d /run/systemd/system ] || ! command -v systemctl >/dev/null 2>&1 ||
    ! systemctl show --property=Version --value >/dev/null 2>&1; then
    exit 0
fi

if command -v flock >/dev/null 2>&1; then
    mkdir -p /run/lock
    exec 9>/run/lock/daed-package-restart.lock
    if ! flock -w 120 9; then
        echo "Failed to acquire daed package restart lock within 120 seconds." >&2
        exit 1
    fi
fi

systemctl daemon-reload
pending=/var/lib/daed/package-restart-required
if [ ! -f "$pending" ]; then
    active_state=$(systemctl show --property=ActiveState --value daed.service)
    case "$active_state" in
        active|activating|reloading|refreshing) ;;
        *) exit 0 ;;
    esac
    install -d -m 0700 /var/lib/daed
    (umask 077; touch "$pending")
fi

if [ "${1:-}" = configure ] && [ -x /usr/sbin/policy-rc.d ]; then
    policy_status=0
    /usr/sbin/policy-rc.d daed.service restart || policy_status=$?
    if [ "$policy_status" -eq 101 ]; then
        echo "Restart of daed.service deferred by policy-rc.d."
        exit 0
    fi
fi

# A successful restart includes the unit's blocking wait-ready command.
if ! systemctl restart daed.service; then
    (umask 077; touch "$pending")
    systemctl status --no-pager daed.service >&2 || true
    echo "Failed to restart daed.service. Restart and readiness verification remain pending in $pending." >&2
    exit 1
fi
rm -f "$pending"
echo "Restarted daed.service and verified readiness after package installation."
