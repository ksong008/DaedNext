#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
: "${RELEASE_DIR:?Set RELEASE_DIR to a directory containing binaries/}"
: "${PACKAGE_VERSION:?Set PACKAGE_VERSION}"
: "${PACKAGE_RELEASE:?Set PACKAGE_RELEASE}"
RELEASE_DIR="$(cd "$RELEASE_DIR" && pwd)"
exec {release_lock}<"$RELEASE_DIR"
flock "$release_lock"
published="$RELEASE_DIR/packages"
if [ -e "$published" ] && { [ ! -d "$published" ] || [ -n "$(find "$published" -mindepth 1 -maxdepth 1 -print -quit)" ]; }; then
  echo 'Package output directory must be empty' >&2
  exit 1
fi
PACKAGE_WORK="$(mktemp -d "$RELEASE_DIR/.package-work.XXXXXX")"
trap 'rm -rf -- "$PACKAGE_WORK"' EXIT
PACKAGE_DIR="$PACKAGE_WORK/packages"
export PACKAGE_WEB_DIR="$PACKAGE_WORK/web"
export PACKAGE_GEODATA_DIR="$PACKAGE_WORK/geodata"
mkdir -p "$PACKAGE_WORK/binaries" "$PACKAGE_DIR" "$PACKAGE_GEODATA_DIR"
cp -aL "$REPO_DIR/dist" "$PACKAGE_WEB_DIR"
cp "$REPO_DIR/build/package-sources/geodata/"{geoip.dat,geosite.dat} "$PACKAGE_GEODATA_DIR/"
for flavor in linux-x86_64-v2 linux-x86_64-v3 linux-arm64; do
  cp -L --preserve=mode "$RELEASE_DIR/binaries/daed-$flavor" "$PACKAGE_WORK/binaries/"
done
python3 "$REPO_DIR/scripts/check_prebuilt_release.py" --release-dir "$PACKAGE_WORK" \
  --web-dir "$PACKAGE_WEB_DIR" --geodata-dir "$PACKAGE_GEODATA_DIR"

(
  export OUT_DIR="$PACKAGE_WORK/linux-x86"
  export BINARY_DIR="$PACKAGE_WORK/x86-binaries"
  mkdir -p "$OUT_DIR" "$BINARY_DIR"
  source "$REPO_DIR/scripts/package_linux_x86_64.sh"
  for level in v2 v3; do
    ln -s "$PACKAGE_WORK/binaries/daed-linux-x86_64-$level" "$BINARY_DIR/daed-x86_64-$level"
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
  package_linux "$PACKAGE_WORK/binaries/daed-linux-arm64"
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
    STRIP_TOOL=strip build_rootfs "$PACKAGE_WORK/binaries/daed-linux-x86_64-$level" "$OUT_DIR/rootfs-$level"
    build_ipk "$OUT_DIR/rootfs-$level" "$OUT_DIR/control-$level" \
      "$PACKAGE_DIR/daed_${PACKAGE_VERSION}-r${PACKAGE_RELEASE}_openwrt_x86_64-$level.ipk" x86_64
    build_apk "$OUT_DIR/rootfs-$level" "$OUT_DIR/scripts-$level" \
      "$PACKAGE_DIR/daed-${PACKAGE_VERSION}-r${PACKAGE_RELEASE}.openwrt-x86_64-$level.apk" x86_64
  done
  build_rootfs "$PACKAGE_WORK/binaries/daed-linux-arm64" "$OUT_DIR/rootfs-arm64"
  for arch in $OPENWRT_ARM64_PACKAGE_ARCHES; do
    build_ipk "$OUT_DIR/rootfs-arm64" "$OUT_DIR/control-$arch" \
      "$PACKAGE_DIR/daed_${PACKAGE_VERSION}-r${PACKAGE_RELEASE}_openwrt_$arch.ipk" "$arch"
    build_apk "$OUT_DIR/rootfs-arm64" "$OUT_DIR/scripts-$arch" \
      "$PACKAGE_DIR/daed-${PACKAGE_VERSION}-r${PACKAGE_RELEASE}.openwrt-$arch.apk" "$arch"
  done
)
(cd "$PACKAGE_DIR" && sha256sum ./*.deb ./*.rpm ./*.ipk ./*.apk > SHA256SUMS)
(cd "$PACKAGE_WORK/binaries" && sha256sum daed-* > "$PACKAGE_WORK/binary.SHA256SUMS")
(cd "$RELEASE_DIR/binaries" && sha256sum --strict --check "$PACKAGE_WORK/binary.SHA256SUMS")
mv -fT "$PACKAGE_WORK/binary.SHA256SUMS" "$RELEASE_DIR/binaries/SHA256SUMS"
mv -fT "$PACKAGE_WORK/source-provenance.json" "$RELEASE_DIR/source-provenance.json"
mv -T "$PACKAGE_DIR" "$published"
