#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/package_openwrt_arm64.sh"

test -x "$ROOT_DIR/install/openwrt/daed.init"
test -f "$ROOT_DIR/install/openwrt/daed.config"
test -x "$ROOT_DIR/install/openwrt/post-install.sh"
sh -n "$ROOT_DIR/install/openwrt/daed.init"
sh -n "$ROOT_DIR/install/openwrt/post-install.sh"

expected_arches="aarch64_generic aarch64_cortex-a53 aarch64_cortex-a72 aarch64_cortex-a76"
if [ "$OPENWRT_ARM64_PACKAGE_ARCHES" != "$expected_arches" ]; then
  printf 'unexpected OpenWrt ARM64 architecture matrix: %s\n' "$OPENWRT_ARM64_PACKAGE_ARCHES" >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
rootfs="$work_dir/rootfs"
mkdir -p "$rootfs/usr/bin"
printf 'daed-openwrt-arm64-packaging-contract\n' >"$rootfs/usr/bin/daed"
chmod 0755 "$rootfs/usr/bin/daed"
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

  ipk_arch="$(ar p "$ipk" control.tar.gz | tar -xzO ./control | sed -n 's/^Architecture: //p')"
  ipk_hash="$(ar p "$ipk" data.tar.gz | tar -xzO ./usr/bin/daed | sha256sum | awk '{print $1}')"
  apk_arch="$(sed -n 's/^arch=//p' "$apk")"
  apk_hash="$(sed -n 's/^binary_sha256=//p' "$apk")"

  test "$ipk_arch" = "$package_arch"
  test "$apk_arch" = "$package_arch"
  test "$ipk_hash" = "$expected_hash"
  test "$apk_hash" = "$expected_hash"
done

printf 'OpenWrt ARM64 packaging contract passed for: %s\n' "$OPENWRT_ARM64_PACKAGE_ARCHES"
