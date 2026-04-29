# Build from Source

This guide covers how to build daed from source code.

---

## 📋 Prerequisites

| Tool                                       | Version | Required |
| ------------------------------------------ | ------- | -------- |
| [Node.js](https://nodejs.org/)             | >= 20   | ✅       |
| [pnpm](https://pnpm.io/)                   | >= 9    | ✅       |
| [Go](https://go.dev/)                      | >= 1.22 | ✅       |
| [Clang](https://clang.llvm.org/)           | >= 15   | ✅       |
| [LLVM](https://llvm.org/)                  | >= 15   | ✅       |
| [Make](https://www.gnu.org/software/make/) | Latest  | ✅       |

---

## 🚀 Quick Build

The following command bootstraps the full stack (`daed` + `dae-wing` + `dae`):

```bash
make
```

This will:

1. Install frontend dependencies
2. Build the frontend assets
3. Compile the Go backend with embedded frontend
4. Output the `daed` binary

## ▶️ Run the Binary

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

## 🎉 Access the Dashboard

Once running, open your browser:

**👉 http://localhost:2023**

Happy Hacking! 🚀
