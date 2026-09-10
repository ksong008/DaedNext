# Source from an interactive Bash startup file to queue daed start/restart jobs.
[[ $- == *i* ]] || return 0

systemctl() {
    if [[ $# -eq 2 ]]; then
        case "$1:$2" in
            start:daed|start:daed.service|restart:daed|restart:daed.service)
                command systemctl --no-block "$@"
                return $?
                ;;
        esac
    fi
    command systemctl "$@"
}
