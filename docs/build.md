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
