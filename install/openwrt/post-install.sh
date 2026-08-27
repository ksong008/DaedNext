#!/bin/sh
set -e

[ -n "${IPKG_INSTROOT:-}" ] && exit 0

daed_init="${DAED_INIT_SCRIPT:-/etc/init.d/daed}"
daed_binary="${DAED_BINARY:-/usr/bin/daed}"
daed_state_dir="${DAED_STATE_DIR:-/etc/daed}"
ready_timeout="${DAED_PACKAGE_READY_TIMEOUT:-60s}"

mkdir -p "$daed_state_dir"
if [ -x "$daed_init" ] && "$daed_init" status >/dev/null 2>&1; then
	restart_output="$(mktemp /tmp/daed-package-restart.XXXXXX)"
	if ! "$daed_init" restart >"$restart_output" 2>&1; then
		cat "$restart_output" >&2
		rm -f "$restart_output"
		echo "Failed to restart daed after package installation; package operation is failing." >&2
		exit 1
	fi
	rm -f "$restart_output"
	if ! "$daed_binary" wait-ready --timeout "$ready_timeout"; then
		"$daed_init" status >&2 || true
		echo "daed did not reach control-plane readiness after package installation." >&2
		exit 1
	fi
	echo "Restarted daed service and verified readiness after package installation."
fi

exit 0
