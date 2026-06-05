#!/bin/sh
set -eu

/usr/bin/daed validate -c /etc/daed/ >/dev/null
exec /usr/bin/daed run -c /etc/daed --listen "${DAED_LISTEN:-0.0.0.0:2023}" "$@"
