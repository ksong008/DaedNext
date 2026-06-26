#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${OUT_DIR:-"$ROOT_DIR/build/packages-linux-x86_64-$(date +%Y%m%d-%H%M%S)"}"
PACKAGE_RELEASE="${PACKAGE_RELEASE:-1}"
PACKAGE_VERSION="${PACKAGE_VERSION:-}"

version_from_binary() {
  local binary="$1"
  local version_line
  version_line="$("$binary" --version)"
  sed -n \
    -e 's/.* version=v\{0,1\}\([^[:space:]]\+\).*/\1/p' \
    -e 's/^daed rust-native product v\{0,1\}\([^[:space:]]\+\).*/\1/p' \
    <<<"$version_line" | head -n 1
}

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

package_flavor() {
  local cpu_level="$1"
  local friendly_name="$2"
  local binary="$ROOT_DIR/daed-x86_64-$cpu_level"
  local package_root="$OUT_DIR/package-root-$cpu_level"
  local package_base="$OUT_DIR/installer-daed-$friendly_name"

  require_file "$binary"
  require_file "$ROOT_DIR/build/package-sources/geodata/geoip.dat"
  require_file "$ROOT_DIR/build/package-sources/geodata/geosite.dat"
  require_file "$ROOT_DIR/install/daed.service"
  require_file "$ROOT_DIR/install/daed.desktop"
  require_file "$ROOT_DIR/install/package_after_install.sh"
  require_file "$ROOT_DIR/install/package_after_remove.sh"
  require_dir "$ROOT_DIR/dist"
  require_dir "$ROOT_DIR/install/icons"

  if [ -z "$PACKAGE_VERSION" ]; then
    PACKAGE_VERSION="$(version_from_binary "$binary")"
  fi
  if [ -z "$PACKAGE_VERSION" ]; then
    printf 'failed to determine package version from %s\n' "$binary" >&2
    exit 1
  fi

  rm -rf "$package_root"
  mkdir -p \
    "$package_root/usr/bin" \
    "$package_root/usr/lib/systemd/system" \
    "$package_root/usr/share/applications" \
    "$package_root/usr/share/daed/web" \
    "$package_root/usr/share/icons/hicolor"

  install -m 0755 "$binary" "$package_root/usr/bin/daed"
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

  fpm -s dir -t deb -a amd64 \
    --version "$PACKAGE_VERSION" \
    --iteration "$PACKAGE_RELEASE" \
    --url 'https://github.com/ksong008/DaedNext' \
    --description 'DaedNext product shell for dae.' \
    --maintainer 'DaedNext Maintainers <noreply@github.com>' \
    --name daed \
    --license 'MIT AGPL' \
    --package "$package_base.deb" \
    --after-install "$ROOT_DIR/install/package_after_install.sh" \
    --after-remove "$ROOT_DIR/install/package_after_remove.sh" \
    -C "$package_root" \
    .

  fpm -s dir -t rpm -a x86_64 \
    --version "$PACKAGE_VERSION" \
    --iteration "$PACKAGE_RELEASE" \
    --url 'https://github.com/ksong008/DaedNext' \
    --description 'DaedNext product shell for dae.' \
    --maintainer 'DaedNext Maintainers <noreply@github.com>' \
    --name daed \
    --license 'MIT AGPL' \
    --package "$package_base.rpm" \
    --after-install "$ROOT_DIR/install/package_after_install.sh" \
    --after-remove "$ROOT_DIR/install/package_after_remove.sh" \
    -C "$package_root" \
    .
}

mkdir -p "$OUT_DIR"

package_flavor v2 linux-x86_64_v2_sse
package_flavor v3 linux-x86_64_v3_avx2

printf '%s\n' "$OUT_DIR" >"$ROOT_DIR/build/latest-linux-x86_64-package-dir"
printf 'packages written to %s\n' "$OUT_DIR"
