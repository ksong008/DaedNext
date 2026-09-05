#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
: "${RELEASE_DIR:?Set RELEASE_DIR to a directory containing binaries/}"
: "${PACKAGE_VERSION:?Set PACKAGE_VERSION}"
: "${PACKAGE_RELEASE:?Set PACKAGE_RELEASE}"
RELEASE_DIR="$(cd "$RELEASE_DIR" && pwd)"
PACKAGE_DIR="$RELEASE_DIR/packages"
mkdir -p "$PACKAGE_DIR"
if find "$PACKAGE_DIR" -maxdepth 1 -type f -print -quit | read -r _; then
  echo 'Package output directory must be empty' >&2
  exit 1
fi
for flavor in linux-x86_64-v2 linux-x86_64-v3 linux-arm64; do
  test -s "$RELEASE_DIR/binaries/daed-$flavor"
done
PACKAGE_WORK="$(mktemp -d "$RELEASE_DIR/../package-work.XXXXXX")"
trap 'rm -rf -- "$PACKAGE_WORK"' EXIT

(
  export OUT_DIR="$PACKAGE_WORK/linux-x86"
  export BINARY_DIR="$PACKAGE_WORK/x86-binaries"
  mkdir -p "$OUT_DIR" "$BINARY_DIR"
  source "$REPO_DIR/scripts/package_linux_x86_64.sh"
  for level in v2 v3; do
    ln -s "$RELEASE_DIR/binaries/daed-linux-x86_64-$level" "$BINARY_DIR/daed-x86_64-$level"
    package_flavor "$level" "linux-x86_64-$level"
    for format in deb rpm; do
      mv "$OUT_DIR/installer-daed-linux-x86_64-$level.$format" \
        "$PACKAGE_DIR/daed-linux-x86_64-${level}_${PACKAGE_VERSION}-${PACKAGE_RELEASE}.$format"
    done
  done
)
(
  export OUT_DIR="$PACKAGE_WORK/linux-arm64"
  mkdir -p "$OUT_DIR"
  source "$REPO_DIR/scripts/package_linux_arm64.sh"
  package_linux "$RELEASE_DIR/binaries/daed-linux-arm64"
  for format in deb rpm; do
    mv "$OUT_DIR/installer-daed-linux-arm64.$format" \
      "$PACKAGE_DIR/daed-linux-arm64_${PACKAGE_VERSION}-${PACKAGE_RELEASE}.$format"
  done
)
(
  export OUT_DIR="$PACKAGE_WORK/openwrt"
  mkdir -p "$OUT_DIR"
  source "$REPO_DIR/scripts/package_openwrt_arm64.sh"
  for level in v2 v3; do
    STRIP_TOOL=strip build_rootfs "$RELEASE_DIR/binaries/daed-linux-x86_64-$level" "$OUT_DIR/rootfs-$level"
    build_ipk "$OUT_DIR/rootfs-$level" "$OUT_DIR/control-$level" \
      "$PACKAGE_DIR/daed_${PACKAGE_VERSION}-r${PACKAGE_RELEASE}_openwrt_x86_64-$level.ipk" x86_64
    build_apk "$OUT_DIR/rootfs-$level" "$OUT_DIR/scripts-$level" \
      "$PACKAGE_DIR/daed-${PACKAGE_VERSION}-r${PACKAGE_RELEASE}.openwrt-x86_64-$level.apk" x86_64
  done
  build_rootfs "$RELEASE_DIR/binaries/daed-linux-arm64" "$OUT_DIR/rootfs-arm64"
  for arch in $OPENWRT_ARM64_PACKAGE_ARCHES; do
    build_ipk "$OUT_DIR/rootfs-arm64" "$OUT_DIR/control-$arch" \
      "$PACKAGE_DIR/daed_${PACKAGE_VERSION}-r${PACKAGE_RELEASE}_openwrt_$arch.ipk" "$arch"
    build_apk "$OUT_DIR/rootfs-arm64" "$OUT_DIR/scripts-$arch" \
      "$PACKAGE_DIR/daed-${PACKAGE_VERSION}-r${PACKAGE_RELEASE}.openwrt-$arch.apk" "$arch"
  done
)
(cd "$PACKAGE_DIR" && sha256sum ./*.deb ./*.rpm ./*.ipk ./*.apk > SHA256SUMS)
(cd "$RELEASE_DIR/binaries" && sha256sum daed-* > SHA256SUMS)
