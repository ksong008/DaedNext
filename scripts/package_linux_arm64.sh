#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAENEXT_ROOT="${DAENEXT_ROOT:-/root/project/DaeNext}"
RUST_TARGET="${RUST_TARGET:-aarch64-unknown-linux-gnu}"
DEB_ARCH="${DEB_ARCH:-arm64}"
RPM_ARCH="${RPM_ARCH:-aarch64}"
OUT_DIR="${OUT_DIR:-"$ROOT_DIR/build/packages-linux-arm64-$(date +%Y%m%d-%H%M%S)"}"
TARGET_DIR="${TARGET_DIR:-"$ROOT_DIR/build/target-linux-arm64-jemalloc"}"
BUILD_LOG="$OUT_DIR/daed-linux-arm64-build.log"
PACKAGE_RELEASE="${PACKAGE_RELEASE:-2}"
PACKAGE_VERSION="${PACKAGE_VERSION:-}"

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

version_from_workspace() {
  sed -n 's/^version = "\([^"]\+\)"/\1/p' "$DAENEXT_ROOT/Cargo.toml" | head -n 1
}

build_daed() {
  mkdir -p "$OUT_DIR"
  (
    cd "$DAENEXT_ROOT"
    CARGO_TARGET_DIR="$TARGET_DIR" \
    CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER="${CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER:-aarch64-linux-gnu-gcc}" \
    CC_aarch64_unknown_linux_gnu="${CC_aarch64_unknown_linux_gnu:-aarch64-linux-gnu-gcc}" \
    CXX_aarch64_unknown_linux_gnu="${CXX_aarch64_unknown_linux_gnu:-aarch64-linux-gnu-g++}" \
    AR_aarch64_unknown_linux_gnu="${AR_aarch64_unknown_linux_gnu:-aarch64-linux-gnu-ar}" \
      cargo build -p dae-daemon --bin daed --release --target "$RUST_TARGET"
  ) >"$BUILD_LOG" 2>&1
}

package_linux() {
  local binary="$1"
  local package_root="$OUT_DIR/package-root"
  local deb_package="$OUT_DIR/installer-daed-linux-arm64.deb"
  local rpm_package="$OUT_DIR/installer-daed-linux-arm64.rpm"

  require_file "$binary"
  require_file "$ROOT_DIR/build/package-sources/geodata/geoip.dat"
  require_file "$ROOT_DIR/build/package-sources/geodata/geosite.dat"
  require_file "$ROOT_DIR/install/daed.service"
  require_file "$ROOT_DIR/install/daed.desktop"
  require_file "$ROOT_DIR/install/package_after_install.sh"
  require_file "$ROOT_DIR/install/package_after_remove.sh"
  require_dir "$ROOT_DIR/dist"
  require_dir "$ROOT_DIR/install/icons"

  rm -rf "$package_root"
  mkdir -p \
    "$package_root/etc/daed" \
    "$package_root/usr/bin" \
    "$package_root/usr/lib/systemd/system" \
    "$package_root/usr/share/applications" \
    "$package_root/usr/share/daed/web" \
    "$package_root/usr/share/icons/hicolor"

  install -m 0755 "$binary" "$package_root/usr/bin/daed"
  if command -v aarch64-linux-gnu-strip >/dev/null 2>&1; then
    aarch64-linux-gnu-strip "$package_root/usr/bin/daed"
  fi
  install -m 0644 "$ROOT_DIR/build/package-sources/geodata/geoip.dat" "$package_root/usr/share/daed/geoip.dat"
  install -m 0644 "$ROOT_DIR/build/package-sources/geodata/geosite.dat" "$package_root/usr/share/daed/geosite.dat"
  install -m 0644 "$ROOT_DIR/install/daed.service" "$package_root/usr/lib/systemd/system/daed.service"
  install -m 0644 "$ROOT_DIR/install/daed.desktop" "$package_root/usr/share/applications/daed.desktop"
  cp -a "$ROOT_DIR/dist/." "$package_root/usr/share/daed/web/"

  for icon in "$ROOT_DIR"/install/icons/*.png; do
    local size
    size="$(basename "$icon" .png)"
    mkdir -p "$package_root/usr/share/icons/hicolor/$size/apps"
    install -m 0644 "$icon" "$package_root/usr/share/icons/hicolor/$size/apps/daed.png"
  done

  rm -f "$deb_package" "$rpm_package"
  fpm -s dir -t deb -a "$DEB_ARCH" \
    --version "$PACKAGE_VERSION" \
    --iteration "$PACKAGE_RELEASE" \
    --url 'https://github.com/ksong008/DaedNext' \
    --description 'DaedNext product shell for dae.' \
    --maintainer 'DaedNext Maintainers <noreply@github.com>' \
    --name daed \
    --license 'MIT AGPL' \
    --package "$deb_package" \
    --after-install "$ROOT_DIR/install/package_after_install.sh" \
    --after-remove "$ROOT_DIR/install/package_after_remove.sh" \
    -C "$package_root" \
    .

  fpm -s dir -t rpm -a "$RPM_ARCH" \
    --version "$PACKAGE_VERSION" \
    --iteration "$PACKAGE_RELEASE" \
    --url 'https://github.com/ksong008/DaedNext' \
    --description 'DaedNext product shell for dae.' \
    --maintainer 'DaedNext Maintainers <noreply@github.com>' \
    --name daed \
    --license 'MIT AGPL' \
    --package "$rpm_package" \
    --after-install "$ROOT_DIR/install/package_after_install.sh" \
    --after-remove "$ROOT_DIR/install/package_after_remove.sh" \
    -C "$package_root" \
    .

  sha256sum "$deb_package" "$rpm_package" >"$OUT_DIR/SHA256SUMS"
  file "$package_root/usr/bin/daed" >"$OUT_DIR/daed-linux-arm64.file"
  dpkg-deb -I "$deb_package" >"$OUT_DIR/installer-daed-linux-arm64.deb.control"
  rpm -qip "$rpm_package" >"$OUT_DIR/installer-daed-linux-arm64.rpm.info"
}

main() {
  mkdir -p "$OUT_DIR"
  if [ -z "$PACKAGE_VERSION" ]; then
    PACKAGE_VERSION="$(version_from_workspace)"
  fi
  if [ -z "$PACKAGE_VERSION" ]; then
    printf 'failed to determine package version\n' >&2
    exit 1
  fi

  build_daed

  local binary="$TARGET_DIR/$RUST_TARGET/release/daed"
  package_linux "$binary"

  printf '%s\n' "$OUT_DIR" >"$ROOT_DIR/build/latest-linux-arm64-package-dir"
  printf 'packages written to %s\n' "$OUT_DIR"
  printf 'deb=%s\n' "$OUT_DIR/installer-daed-linux-arm64.deb"
  printf 'rpm=%s\n' "$OUT_DIR/installer-daed-linux-arm64.rpm"
  printf 'build_log=%s\n' "$BUILD_LOG"
}

main "$@"
