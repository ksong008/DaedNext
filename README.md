<div align="center">
  <img src="apps/web/public/logo.webp" alt="daed logo" width="120" />
  <h1>daed</h1>
  <p><strong>Product shell and web dashboard for dae</strong></p>

  <p>
    <a href="https://github.com/ksong008/DaedNext/actions/workflows/release-please.yml"><img src="https://img.shields.io/github/actions/workflow/status/ksong008/daednext/release-please.yml?style=for-the-badge" alt="Build Status" /></a>
    <a href="https://github.com/ksong008/DaedNext/releases"><img src="https://img.shields.io/github/v/release/ksong008/daednext?style=for-the-badge" alt="Release" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT%20%2F%20AGPL--3.0-blue?style=for-the-badge" alt="License: MIT / AGPL-3.0" /></a>
    <a href="https://github.com/ksong008/DaedNext/pulls"><img src="https://img.shields.io/github/issues-pr-closed/ksong008/daednext?style=for-the-badge" alt="Pull Requests" /></a>
  </p>

  <p>
    <a href="#features">Features</a> |
    <a href="#getting-started">Getting Started</a> |
    <a href="#docker-deployment">Docker</a> |
    <a href="#build-from-source">Build</a> |
    <a href="#development">Development</a> |
    <a href="#license">License</a>
  </p>
</div>

---

## Screenshots

<details open>
<summary><b>Desktop Screenshots</b></summary>

|                                Setup                                |                                   Orchestrate                                   |
| :-----------------------------------------------------------------: | :-----------------------------------------------------------------------------: |
| <img src="docs/screenshots/pc/setup.png" alt="setup" width="400" /> | <img src="docs/screenshots/pc/orchestrate.png" alt="orchestrate" width="400" /> |

</details>

<details>
<summary><b>Mobile Screenshots</b></summary>

|                                  Setup                                  |                                     Orchestrate                                     |
| :---------------------------------------------------------------------: | :---------------------------------------------------------------------------------: |
| <img src="docs/screenshots/mobile/setup.png" alt="setup" width="200" /> | <img src="docs/screenshots/mobile/orchestrate.png" alt="orchestrate" width="200" /> |

</details>

---

## Features

- Web dashboard for managing a running `daed` instance, including setup and
  orchestration workflows.
- Product build shell that bundles the WebUI with the Rust-native daemon from
  the [DaeNext](https://github.com/ksong008/DaeNext) workspace.
- Release workflow for Linux x86_64 v1/v2/v3 binaries and distro packages
  (`deb`, `rpm`, and `pkg.tar.zst`).
- Docker images for host-network deployments that need access to Linux eBPF,
  system networking, and `/etc/daed` state.
- Shared RoutingA tooling packages: Monaco editor support, node parser, language
  server, and VS Code extension package.
- Screenshot, integration-audit, type-check, lint, and package-publish tooling
  for the WebUI and companion packages.

## Getting Started

Please refer to the [Quick Start Guide](./docs/getting-started.md) to install
and run daed.

Once daed is running, open the dashboard at:

```text
http://localhost:2023
```

## Docker Deployment

Prebuilt images are published under:

- `ghcr.io/ksong008/daednext`
- `quay.io/ksong008/daednext`
- `ksong008/daednext`

Run the container:

```bash
docker run -d \
    --privileged \
    --network=host \
    --pid=host \
    --restart=always \
    -v /sys:/sys \
    -v /etc/daed:/etc/daed \
    --name=daed \
    ghcr.io/ksong008/daednext:latest
```

Or use Docker Compose:

```yaml
# docker-compose.yml
services:
  daed:
    image: ghcr.io/ksong008/daednext:latest
    container_name: daed
    privileged: true
    network_mode: host
    pid: host
    restart: always
    volumes:
      - /sys:/sys
      - /etc/daed:/etc/daed
```

```bash
docker compose up -d
```

## Build From Source

The default product build creates a Rust-native `daed` binary by building the
WebUI first, then compiling `dae-daemon --bin daed` from the DaeNext Cargo
workspace.

Prerequisites:

- [Node.js](https://nodejs.org/) >= 22.12.0
- [pnpm](https://pnpm.io/) 10.x
- [Rust](https://www.rust-lang.org/) stable
- Rust nightly with `rust-src` for native eBPF builds
- `clang`, `llvm`, and `bpf-linker`
- CMake, Perl, `pkg-config`, libelf development headers, and a C/C++ compiler

Recommended checkout layout:

```bash
git clone https://github.com/ksong008/DaedNext.git
git clone https://github.com/ksong008/DaeNext.git
cd DaedNext
```

Build the product binary:

```bash
pnpm install
make RUST_WORKSPACE=../DaeNext
```

The Makefile auto-detects `./DaeNext`, `../DaeNext`, or `../../DaeNext`. Use
`RUST_WORKSPACE=/path/to/DaeNext` when your checkout uses a different layout.

### Build Parameters

The Makefile keeps the DaeNext Cargo default features enabled. Its default
`RUST_FEATURES=native-ebpf` is additive, so a normal product build also includes
the product API, resident runtime, jemalloc, and the production BoringSSL
TCP-TLS and QUIC providers.

| Make or environment parameter           | Default          | Meaning                                                                                                                 |
| --------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `RUST_WORKSPACE`                        | auto-detected    | Path to the DaeNext Cargo workspace.                                                                                    |
| `RUST_TARGET`                           | host target      | Rust target triple. Cross builds also require the matching Rust target, linker, C compiler, C++ compiler, and archiver. |
| `RUST_TARGET_DIR`                       | `DaeNext/target` | Cargo cache/output directory. Use a different directory for each target or CPU level when builds run concurrently.      |
| `RUST_FEATURES`                         | `native-ebpf`    | Additional `dae-daemon` Cargo features. This does not disable default features.                                         |
| `RUSTFLAGS`                             | unset            | Rust compiler flags. Release jobs use it to select the CPU baseline with `-C target-cpu=...`.                           |
| `CARGO_PROFILE_RELEASE_LTO`             | `fat`            | Selects the default Fat LTO release profile; override only for a controlled comparison build.                           |
| `CARGO_PROFILE_RELEASE_CODEGEN_UNITS`   | `1`              | Selects the default release codegen-unit count; override only for a controlled comparison build.                        |
| `OUTPUT`                                | `daed`           | Destination path of the final stripped product binary.                                                                  |
| `VERSION`                               | `0.0.0.unknown`  | Product version embedded in `daed --version`.                                                                           |
| `DAED_SKIP_WEB_BUILD`                   | unset            | Reuses the existing `dist/` directory instead of rebuilding the WebUI. The directory must already exist.                |
| `DAED_PRODUCT_TARGET`                   | derived          | Overrides only the target text embedded in the product identity; it does not configure Cargo.                           |
| `DAED_PRODUCT_FEATURES`                 | derived          | Overrides only the feature text embedded in the product identity; it does not enable Cargo features.                    |
| `DAED_PRODUCT_VERSION`                  | derived          | Overrides the complete embedded product identity string.                                                                |
| `TARGET_OS`, `TARGET_ARCH`, `CPU_LEVEL` | unset            | Supply release identity labels. They do not select a compiler target or CPU instruction set by themselves.              |

Build an x86_64-v2 product binary with the default Fat LTO profile:

```bash
CARGO_PROFILE_RELEASE_LTO=fat \
CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1 \
RUSTFLAGS="-C target-cpu=x86-64-v2" \
make RUST_WORKSPACE=../DaeNext \
  RUST_TARGET_DIR=/tmp/daed-target-x86_64-v2 \
  TARGET_OS=linux TARGET_ARCH=x86_64 CPU_LEVEL=v2 \
  OUTPUT=daed-x86_64-v2
```

Use `-C target-cpu=x86-64` for the widest x86_64 compatibility,
`x86-64-v2` for the v2 baseline, and `x86-64-v3` only for AVX2-class systems.
Do not publish a binary built with `target-cpu=native`.

An ARM64 cross build uses the generic ARMv8-A baseline, which includes
Cortex-A53 compatibility at the ISA level:

```bash
rustup target add aarch64-unknown-linux-gnu

CARGO_PROFILE_RELEASE_LTO=fat \
CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1 \
RUSTFLAGS="-C target-cpu=generic" \
CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc \
CXX_aarch64_unknown_linux_gnu=aarch64-linux-gnu-g++ \
AR_aarch64_unknown_linux_gnu=aarch64-linux-gnu-ar \
make RUST_WORKSPACE=../DaeNext \
  RUST_TARGET=aarch64-unknown-linux-gnu \
  RUST_TARGET_DIR=/tmp/daed-target-aarch64-generic \
  TARGET_OS=linux TARGET_ARCH=aarch64 \
  OUTPUT=daed-arm64
```

The ARM64 CPU baseline and an OpenWrt package architecture are separate
contracts. A generic ARMv8-A ELF can run on several ARM64 CPU families, but an
OpenWrt package must still use the architecture label accepted by the target,
such as `aarch64_generic` or `aarch64_cortex-a53`.

The tracked `scripts/package_openwrt_arm64.sh` helper compiles one generic
ARMv8-A binary and packages it for the official `aarch64_generic`,
`aarch64_cortex-a53`, `aarch64_cortex-a72`, and `aarch64_cortex-a76` package
architectures. Set `APK_TOOL` when the OpenWrt `apk` executable is not on
`PATH`; `OPENWRT_ARM64_PACKAGE_ARCHES` may be overridden for a narrower local
package set.

`bpf-btf` shown by `daed --version` is a capability label derived from
`native-ebpf`; it is not a Cargo feature that should be passed through
`RUST_FEATURES`. For allocator experiments, use DaeNext directly with a full
`--no-default-features` feature list: adding `allocator-system` through this
Makefile would otherwise leave the default `allocator-jemalloc` enabled and the
build correctly fails their mutual-exclusion check.

For installation and runtime steps, see
[Build from Source](./docs/build.md).

## Development

### WebUI Prerequisites

- [Node.js](https://nodejs.org/) >= 22.12.0
- [pnpm](https://pnpm.io/) 10.x

### Setup

```bash
pnpm install
pnpm dev
```

### Available Scripts

| Command                 | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `pnpm dev`              | Start the WebUI development server                 |
| `pnpm build`            | Build packages and the WebUI                       |
| `pnpm test`             | Run package and app tests                          |
| `pnpm check-types`      | Run TypeScript checks                              |
| `pnpm test:integration` | Run the browser audit against an existing daed API |
| `pnpm lint`             | Lint and fix source files                          |
| `pnpm screenshot`       | Regenerate README screenshots from mock mode       |
| `make`                  | Build the bundled Rust-native product binary       |

## Repository Layout

- `apps/web/`: React/Vite WebUI for daed.
- `packages/`: RoutingA editor, parser, LSP, language core, and VS Code support.
- `install/`: systemd unit, desktop metadata, icons, and package hooks.
- `docs/`: user-facing install/build docs and README screenshots.
- `scripts/`: screenshot generation, integration audit, and repository checks.
- `Makefile`: product bundling entrypoint for WebUI plus DaeNext Rust core.

## Release Boundary

This repository owns the daed product shell: WebUI assets, package metadata,
installer layout, Docker image layout, and the top-level product build flow.

The daemon core is built from the DaeNext Rust workspace. Release workflows
checkout `ksong008/DaeNext`, build the Rust-native `daed` binary with native
eBPF support, then package it with this repository's WebUI and install assets.

## Contributing

Contributions are welcome. Please read the [Contributing Guide](./CONTRIBUTING.md)
before submitting a PR.

Special thanks to all [contributors](https://github.com/ksong008/DaedNext/graphs/contributors).

<a href="https://github.com/ksong008/DaedNext/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ksong008/daednext" alt="Contributors" />
</a>

## License

This project is licensed as follows:

- Frontend, WebUI, and JavaScript packages: [MIT License](./LICENSE)
- Rust-native daemon workspace: [AGPL-3.0 License](https://github.com/ksong008/DaeNext)

## Original Source

This project originates from the daed project:
[https://github.com/daeuniverse/daed](https://github.com/daeuniverse/daed).
