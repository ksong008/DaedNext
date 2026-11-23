#!/bin/sh
set -e

[ -n "${IPKG_INSTROOT:-}" ] && exit 0

mkdir -p /etc/daed
exec /etc/init.d/daed package_restart
