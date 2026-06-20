#!/bin/bash
systemctl daemon-reload

if systemctl is-active --quiet daed.service; then
    if command -v flock >/dev/null 2>&1; then
        mkdir -p /run/lock
        (
            if flock -w 120 9; then
                if systemctl restart daed.service; then
                    echo "Restarted daed.service after package installation."
                else
                    echo "Failed to restart daed.service after package installation; inspect systemctl status daed.service."
                fi
            else
                echo "Skipped daed.service package restart because another daed package restart is still running."
            fi
        ) 9>/run/lock/daed-package-restart.lock
    else
        if systemctl restart daed.service; then
            echo "Restarted daed.service after package installation."
        else
            echo "Failed to restart daed.service after package installation; inspect systemctl status daed.service."
        fi
    fi
fi
