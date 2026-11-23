#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/package_openwrt_arm64.sh"

test -x "$ROOT_DIR/install/openwrt/daed.init"
test -f "$ROOT_DIR/install/openwrt/daed.config"
test -x "$ROOT_DIR/install/openwrt/post-install.sh"
for file in daed.init post-install.sh pre-remove.sh; do
  sh -n "$ROOT_DIR/install/openwrt/$file"
done

expected_arches="aarch64_generic aarch64_cortex-a53 aarch64_cortex-a72 aarch64_cortex-a76"
if [ "$OPENWRT_ARM64_PACKAGE_ARCHES" != "$expected_arches" ]; then
  printf 'unexpected OpenWrt ARM64 architecture matrix: %s\n' "$OPENWRT_ARM64_PACKAGE_ARCHES" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
rootfs="$work_dir/rootfs"
PACKAGE_WEB_DIR="$work_dir/web"
PACKAGE_GEODATA_DIR="$work_dir/geodata"
mkdir -p "$PACKAGE_WEB_DIR" "$PACKAGE_GEODATA_DIR"
touch "$PACKAGE_WEB_DIR/index.html" "$PACKAGE_GEODATA_DIR/geoip.dat" "$PACKAGE_GEODATA_DIR/geosite.dat"
STRIP_TOOL="strip" build_rootfs /bin/true "$rootfs"
expected_hash="$(sha256sum "$rootfs/usr/bin/daed" | awk '{print $1}')"

fake_apk="$work_dir/apk"
cat >"$fake_apk" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

[ "${1:-}" = "mkpkg" ]
shift
rootfs=
output=
arch=
scripts=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --files)
      rootfs="$2"
      shift 2
      ;;
    --output)
      output="$2"
      shift 2
      ;;
    --info)
      case "$2" in
        arch:*) arch="${2#arch:}" ;;
      esac
      shift 2
      ;;
    --script)
      test -x "${2#*:}"
      scripts+=("${2%%:*}")
      shift 2
      ;;
    *)
      printf 'unexpected apk argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done
test -n "$rootfs"
test -n "$output"
test -n "$arch"
test "${scripts[*]}" = "post-install post-upgrade pre-deinstall"
test "$(cat "$rootfs/lib/upgrade/keep.d/daed")" = /etc/daed/
test "$(cat "$rootfs/lib/apk/packages/daed.conffiles")" = /etc/config/daed
config_hash="$(sha256sum <"$rootfs/etc/config/daed")"
test "$(cat "$rootfs/lib/apk/packages/daed.conffiles_static")" = "/etc/config/daed ${config_hash%% *}"
printf 'arch=%s\nbinary_sha256=%s\n' "$arch" "$(sha256sum "$rootfs/usr/bin/daed" | awk '{print $1}')" >"$output"
EOF
chmod 0755 "$fake_apk"
APK_TOOL="$fake_apk"
PACKAGE_VERSION=3.1.0
PACKAGE_RELEASE=1

for package_arch in $OPENWRT_ARM64_PACKAGE_ARCHES; do
  ipk="$work_dir/daed_${package_arch}.ipk"
  apk="$work_dir/daed_${package_arch}.apk"
  build_ipk "$rootfs" "$work_dir/control-$package_arch" "$ipk" "$package_arch"
  build_apk "$rootfs" "$work_dir/scripts-$package_arch" "$apk" "$package_arch"

  test "$(tar -tzf "$ipk")" = "$(printf '%s\n' ./debian-binary ./data.tar.gz ./control.tar.gz)"
  test "$(tar -xzOf "$ipk" ./debian-binary)" = 2.0
  ipk_arch="$(tar -xzOf "$ipk" ./control.tar.gz | tar -xzO ./control | sed -n 's/^Architecture: //p')"
  ipk_hash="$(tar -xzOf "$ipk" ./data.tar.gz | tar -xzO ./usr/bin/daed | sha256sum | awk '{print $1}')"
  test "$(tar -xzOf "$ipk" ./data.tar.gz | tar -xzO ./lib/upgrade/keep.d/daed)" = /etc/daed/
  test ! -e "$rootfs/lib/apk"
  apk_arch="$(sed -n 's/^arch=//p' "$apk")"
  apk_hash="$(sed -n 's/^binary_sha256=//p' "$apk")"

  test "$ipk_arch" = "$package_arch"
  test "$apk_arch" = "$package_arch"
  test "$ipk_hash" = "$expected_hash"
  test "$apk_hash" = "$expected_hash"
done

printf 'OpenWrt ARM64 packaging contract passed for: %s\n' "$OPENWRT_ARM64_PACKAGE_ARCHES"
