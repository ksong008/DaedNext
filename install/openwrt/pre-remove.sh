#!/bin/sh
set -e

[ -n "${IPKG_INSTROOT:-}" ] && exit 0

# opkg invokes prerm with "upgrade". APK only calls this hook on removal.
[ "${1:-}" = "upgrade" ] && exit 0

if [ -x /etc/init.d/daed ]; then
	exec /etc/init.d/daed package_remove
fi
