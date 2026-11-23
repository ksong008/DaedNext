#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_WEB_DIR="${PACKAGE_WEB_DIR:-$ROOT_DIR/dist}"
PACKAGE_GEODATA_DIR="${PACKAGE_GEODATA_DIR:-$ROOT_DIR/build/package-sources/geodata}"
DAENEXT_ROOT="${DAENEXT_ROOT:-$(
  for directory in "$ROOT_DIR/DaeNext" "$ROOT_DIR/../DaeNext" "$ROOT_DIR/../../DaeNext"; do
    if [ -f "$directory/Cargo.toml" ]; then
      cd "$directory" && pwd
      break
    fi
  done
)}"
RUST_TARGET="${RUST_TARGET:-aarch64-unknown-linux-gnu}"
OPENWRT_ARM64_PACKAGE_ARCHES="${OPENWRT_ARM64_PACKAGE_ARCHES:-aarch64_generic aarch64_cortex-a53 aarch64_cortex-a72 aarch64_cortex-a76}"
CPU_TARGET="${CPU_TARGET:-generic}"
OUT_DIR="${OUT_DIR:-$ROOT_DIR/build/openwrt-arm64-$(date +%Y%m%d-%H%M%S)}"
TARGET_DIR="${TARGET_DIR:-$ROOT_DIR/build/target-openwrt-arm64}"
BUILD_LOG="$OUT_DIR/daed-openwrt-arm64-build.log"
PACKAGE_VERSION="${PACKAGE_VERSION:-}"
PACKAGE_RELEASE="${PACKAGE_RELEASE:-1}"
APK_TOOL="${APK_TOOL:-apk}"
APK_TOOL_LIB="${APK_TOOL_LIB:-}"

require_file() {
  local path="$1"
  if [ ! -f "$path" ]; then
    printf 'missing required file: %s\n' "$path" >&2
    exit 1
  fi
}

require_dir() {
  local path="$1"
  if [ ! -d "$path" ]; then
    printf 'missing required directory: %s\n' "$path" >&2
    exit 1
  fi
}

run_apk() {
  if [ -n "$APK_TOOL_LIB" ]; then
    LD_LIBRARY_PATH="$APK_TOOL_LIB${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" "$APK_TOOL" "$@"
  else
    "$APK_TOOL" "$@"
  fi
}

version_from_workspace() {
  sed -n 's/^version = "\([^"]\+\)"/\1/p' "$DAENEXT_ROOT/Cargo.toml" | head -n 1
}

build_daed() {
  require_dir "$DAENEXT_ROOT"
  mkdir -p "$OUT_DIR"
  (
    cd "$ROOT_DIR"
    CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER="${CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER:-aarch64-linux-gnu-gcc}" \
    CC_aarch64_unknown_linux_gnu="${CC_aarch64_unknown_linux_gnu:-aarch64-linux-gnu-gcc}" \
    CXX_aarch64_unknown_linux_gnu="${CXX_aarch64_unknown_linux_gnu:-aarch64-linux-gnu-g++}" \
    AR_aarch64_unknown_linux_gnu="${AR_aarch64_unknown_linux_gnu:-aarch64-linux-gnu-ar}" \
    RUSTFLAGS="${RUSTFLAGS:--C target-feature=+crt-static -C target-cpu=$CPU_TARGET}" \
      make daed-rust-native DAED_SKIP_WEB_BUILD=1 \
        RUST_WORKSPACE="$DAENEXT_ROOT" RUST_TARGET_DIR="$TARGET_DIR" RUST_TARGET="$RUST_TARGET" \
        OUTPUT="$OUT_DIR/daed" VERSION="${DAED_VERSION:-$PACKAGE_VERSION-rb$PACKAGE_RELEASE}" \
        DAED_PRODUCT_TARGET=linux-arm64
  ) >"$BUILD_LOG" 2>&1
}

build_rootfs() {
  local binary="$1"
  local rootfs="$2"

  require_file "$binary"
  require_file "$PACKAGE_GEODATA_DIR/geoip.dat"
  require_file "$PACKAGE_GEODATA_DIR/geosite.dat"
  require_dir "$PACKAGE_WEB_DIR"

  rm -rf "$rootfs"
  mkdir -p "$rootfs/usr/bin" "$rootfs/usr/share/daed/web" \
    "$rootfs/etc/init.d" "$rootfs/etc/config" "$rootfs/etc/daed" \
    "$rootfs/lib/upgrade/keep.d"
  install -m 0755 "$binary" "$rootfs/usr/bin/daed"
  if command -v "${STRIP_TOOL:-aarch64-linux-gnu-strip}" >/dev/null 2>&1; then
    "${STRIP_TOOL:-aarch64-linux-gnu-strip}" "$rootfs/usr/bin/daed"
  elif command -v llvm-strip >/dev/null 2>&1; then
    llvm-strip "$rootfs/usr/bin/daed"
  fi
  install -m 0644 "$PACKAGE_GEODATA_DIR/geoip.dat" "$rootfs/usr/share/daed/geoip.dat"
  install -m 0644 "$PACKAGE_GEODATA_DIR/geosite.dat" "$rootfs/usr/share/daed/geosite.dat"
  cp -a "$PACKAGE_WEB_DIR/." "$rootfs/usr/share/daed/web/"
  install -m 0755 "$ROOT_DIR/install/openwrt/daed.init" "$rootfs/etc/init.d/daed"
  install -m 0644 "$ROOT_DIR/install/openwrt/daed.config" "$rootfs/etc/config/daed"
  install -m 0644 "$ROOT_DIR/install/openwrt/daed.keep" "$rootfs/lib/upgrade/keep.d/daed"
}

build_ipk() {
  local rootfs="$1"
  local control_dir="$2"
  local package="$3"
  local package_arch="$4"

  rm -rf "$control_dir"
  mkdir -p "$control_dir"
  cat >"$control_dir/control" <<EOF
Package: daed
Version: $PACKAGE_VERSION-r$PACKAGE_RELEASE
Architecture: $package_arch
Maintainer: DaedNext Maintainers <noreply@github.com>
Section: net
Priority: optional
Depends: ca-bundle
Source: https://github.com/ksong008/DaeNext
Description: DaedNext Rust-native daemon for OpenWrt $package_arch with jemalloc.
EOF
  printf '/etc/config/daed\n' >"$control_dir/conffiles"
  install -m 0755 "$ROOT_DIR/install/openwrt/post-install.sh" "$control_dir/postinst"
  install -m 0755 "$ROOT_DIR/install/openwrt/pre-remove.sh" "$control_dir/prerm"

  local work
  work="${control_dir}.work"
  rm -rf "$work"
  mkdir -p "$work"
  printf '2.0\n' >"$work/debian-binary"
  tar --sort=name --owner=0 --group=0 --numeric-owner -czf "$work/control.tar.gz" -C "$control_dir" .
  tar --sort=name --owner=0 --group=0 --numeric-owner -czf "$work/data.tar.gz" -C "$rootfs" .
  tar --owner=0 --group=0 --numeric-owner -czf "$package" -C "$work" \
    ./debian-binary ./data.tar.gz ./control.tar.gz
}

build_apk() {
  local rootfs="$1"
  local scripts_dir="$2"
  local package="$3"
  local package_arch="$4"

  rm -rf "$scripts_dir"
  mkdir -p "$scripts_dir"
  install -m 0755 "$ROOT_DIR/install/openwrt/post-install.sh" "$scripts_dir/post-install"
  install -m 0755 "$ROOT_DIR/install/openwrt/post-install.sh" "$scripts_dir/post-upgrade"
  install -m 0755 "$ROOT_DIR/install/openwrt/pre-remove.sh" "$scripts_dir/pre-deinstall"

  (
    local metadata="$rootfs/lib/apk/packages"
    local config_hash
    mkdir -p "$metadata"
    trap 'rm -f "$metadata/daed.conffiles" "$metadata/daed.conffiles_static"
          rmdir "$metadata" "$rootfs/lib/apk" 2>/dev/null || true' EXIT
    printf '/etc/config/daed\n' >"$metadata/daed.conffiles"
    config_hash="$(sha256sum <"$rootfs/etc/config/daed")"
    printf '/etc/config/daed %s\n' "${config_hash%% *}" >"$metadata/daed.conffiles_static"
    run_apk mkpkg \
      --files "$rootfs" \
      --output "$package" \
      --info name:daed \
      --info version:"$PACKAGE_VERSION-r$PACKAGE_RELEASE" \
      --info arch:"$package_arch" \
      --info description:"DaedNext Rust-native daemon for OpenWrt $package_arch with jemalloc." \
      --info license:AGPL-3.0-only \
      --info origin:DaeNext \
      --info depends:ca-bundle \
      --info maintainer:'DaedNext Maintainers <noreply@github.com>' \
      --info url:https://github.com/ksong008/DaeNext \
      --script post-install:"$scripts_dir/post-install" \
      --script post-upgrade:"$scripts_dir/post-upgrade" \
      --script pre-deinstall:"$scripts_dir/pre-deinstall"
  )
}

main() {
  if [ -z "$PACKAGE_VERSION" ]; then
    PACKAGE_VERSION="$(version_from_workspace)"
  fi
  if [ -z "$PACKAGE_VERSION" ]; then
    printf 'failed to determine package version\n' >&2
    exit 1
  fi

  build_daed
  local rootfs="$OUT_DIR/rootfs"
  build_rootfs "$OUT_DIR/daed" "$rootfs"

  local package_arch
  for package_arch in $OPENWRT_ARM64_PACKAGE_ARCHES; do
    build_ipk "$rootfs" "$OUT_DIR/ipk-control-$package_arch" \
      "$OUT_DIR/daed_${PACKAGE_VERSION}-r${PACKAGE_RELEASE}_openwrt_${package_arch}_jemalloc.ipk" "$package_arch"
    build_apk "$rootfs" "$OUT_DIR/apk-scripts-$package_arch" \
      "$OUT_DIR/daed-${PACKAGE_VERSION}-r${PACKAGE_RELEASE}.openwrt-${package_arch}-jemalloc.apk" "$package_arch"
  done

  sha256sum "$OUT_DIR"/*.ipk "$OUT_DIR"/*.apk >"$OUT_DIR/SHA256SUMS"
  file "$rootfs/usr/bin/daed" >"$OUT_DIR/daed-openwrt-arm64.file"
  printf 'packages written to %s\n' "$OUT_DIR"
  printf 'package_arches=%s\n' "$OPENWRT_ARM64_PACKAGE_ARCHES"
  printf 'build_log=%s\n' "$BUILD_LOG"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
