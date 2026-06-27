#!/bin/bash
systemctl stop daed.service >/dev/null 2>&1 || true
ip link del dae0 >/dev/null 2>&1 || true
ip netns del dae >/dev/null 2>&1 || true
rm -rf /run/daed
systemctl daemon-reload
