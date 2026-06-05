# Build from Source

This guide covers how to build daed from source code.

---

## Prerequisites

| Tool                                       | Version | Required |
| ------------------------------------------ | ------- | -------- |
| [Node.js](https://nodejs.org/)             | >= 20   | ✅       |
| [pnpm](https://pnpm.io/)                   | >= 9    | ✅       |
| [Rust](https://www.rust-lang.org/)         | stable  | ✅       |
| [Go](https://go.dev/)                      | >= 1.24 | ✅       |
| [Clang](https://clang.llvm.org/)           | >= 15   | ✅       |
| [LLVM](https://llvm.org/)                  | >= 15   | ✅       |
| [Make](https://www.gnu.org/software/make/) | Latest  | ✅       |

---

## Quick Build

The default build produces the Rust native `daed` product binary:

```bash
make
```

This will:

1. Install frontend dependencies
2. Build the frontend assets
3. Generate the current kernel BPF object through the aligned `dae` core build path
4. Compile the Rust `daed` binary
5. Output the `daed` binary

The explicit Go rollback bundle is still available for compatibility testing:

```bash
make daed-go-rollback
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
