# Build from Source

This guide covers how to build daed from source code.

---

## Prerequisites

| Tool                                       | Version    | Required |
| ------------------------------------------ | ---------- | -------- |
| [Node.js](https://nodejs.org/)             | >= 22.12.0 | ✅       |
| [pnpm](https://pnpm.io/)                   | >= 9       | ✅       |
| [Rust](https://www.rust-lang.org/)         | stable     | ✅       |
| [Clang](https://clang.llvm.org/)           | >= 15      | ✅       |
| [LLVM](https://llvm.org/)                  | >= 15      | ✅       |
| [Make](https://www.gnu.org/software/make/) | Latest     | ✅       |

---

## Quick Build

The default build produces the Rust native `daed` product binary:

```bash
make
```

This will:

1. Install frontend dependencies
2. Build the frontend assets
3. Compile the Rust `daed` binary from the DaeNext Cargo workspace
4. Output the `daed` binary

The Rust workspace path is auto-detected from `./DaeNext`, `../DaeNext`, or
`../../DaeNext`. Override it when your checkout uses a different layout:

```bash
make RUST_WORKSPACE=/path/to/DaeNext
```

## Package Prebuilt Binaries

`scripts/package_prebuilt_release.sh` packages an already verified set of static
Linux binaries without recompiling them. Place `daed-linux-x86_64-v2`,
`daed-linux-x86_64-v3`, and `daed-linux-arm64` in `RELEASE_DIR/binaries/`.
The package output directory must be empty. Build the current web assets into
`dist/` and provide full `geoip.dat` and `geosite.dat` files in
`build/package-sources/geodata/` before running:

```bash
RELEASE_DIR="$PWD/build/rb72/release-final" \
PACKAGE_VERSION=3.1.0 PACKAGE_RELEASE=72 \
APK_TOOL=/path/to/apk \
bash scripts/package_prebuilt_release.sh
```

This requires `fpm`, RPM and DEB packaging tools, `ar`, native and ARM64 `strip`,
and apk-tools 3 with `mkpkg`. It creates six Linux DEB/RPM packages and twelve
OpenWrt IPK/APK packages: x86_64 v2/v3 plus aarch64 generic, cortex-a53, cortex-a72,
and cortex-a76. All ARM64 package labels use the same generic ARM64 binary.
Intermediate package roots are temporary; packages and SHA256 manifests remain
in the release directory. APK files are unsigned and require the target's local
package trust override when installing.

## Run the Binary

```bash
# Make executable and install
sudo chmod +x ./daed
sudo install -Dm755 daed /usr/bin/

# Run daed
sudo daed run

# Show help
daed --help
```

---

## Access the Dashboard

Once running, open your browser:

http://localhost:2023
